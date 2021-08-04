/**
 * Copyright 2021 Opstrace, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { strict as assert } from "assert";
import got, { Response as GotResponse } from "got";

import {
  customGotRetryfunc,
  mtime,
  mtimeDiffSeconds,
  log
} from "@opstrace/utils";

// High-level overview of what this module is adding on top of
// jwt({
//   secret: jwksRsa.expressJwtSecret({
//     cache: true,
//     rateLimit: true,
//     jwksRequestsPerMinute: 5,
//     jwksUri: JWKS_URL,
//   }),
//
// - A custom JWKS HTTP endpoint fetch function using the got() HTTP client
//   with carefully chosen retrying parameters and logging
// - A use-stale-item-if-refresh-failed technique for making the cache more
//   usefule and robust.
// - A prepopulate-upon-app-start technique to make the first login more
//   robust and fast  (minimize hot path impact)

// This bypasses the cache mechanism in jwks-rksa / adds to it using the
// assumption that public keys are practically never rotated. I don't think
// that the cache built into jwks-rksa has the following important
// functionality: if the cache is stale and fetching new data fails: instead of
// erroring out the operation simply try to use the 'last known good key set',
// even if that's technically 'outdated', based on the cache configuration. The
// probability for that "stale" cache item to contain the correct public key is
// practically 100 %. Another property that jwks-rsa does not provide is
// 'prepopulation' before the first request, at least it's not clear how to do
// that.
let LAST_JWKS_POTENTIALLY_STALE: object;
let LAST_JWKS_SET_TIME: bigint;
let FIRST_JWKS_FROM_PREPOPULATE_CALL: object | undefined;

// JWKS request-adjusted timeout constants. Paradigm: fail fast to allow
// for a quick retry to potentially heal what went wrong (L4 round-robin
// load balancing for example might result in a different network path
// between attempts, we want to make use of that).
const GOT_JWKS_HTTP_TIMEOUT_SETTINGS = {
  // Rely on this to be between data centers (not involving a
  // consumer-grade Internet conn). If a TCP connect() takes longer then
  // ~5 seconds then most certainly there is a networking issue. Use value
  // slightly larger than 3 s, initial TCP retransmit timeout.
  connect: 3400,
  // After TCP-connect, this controls the max time the TLS handshake is
  // allowed to take.
  secureConnect: 2000,
  // After TLS over TCP ist established, require the few request bytes to
  // (just a GET w/o body) to be written real quick.
  send: 1000,
  // After having written the request, expect response _headers_ to
  // arrive within that time (not the complete response).
  response: 2500,
  // global timeout, supposedly until final response byte arrived.
  request: 8500
};

// From the jwks-rsa docs: "Even if caching is enabled the library will call
// the JWKS endpoint if the kid is not available in the cache, because a key
// rotation could have taken place."

// Future: ideally, never fetch this in the hot path unless it is known that
// the required key ID is not in the cache. Trigger a refresh every now and
// then in the hot path, but don't wait for the result. That however requires
// an override for the case where `kid` is not in the current JWKS in that case
// we have to get a fresh key set, to see if rotation just took place.

// Choose high-level retrying parameters. Note(JP): remember that this retrying
// machinery may be performed as part of processing an incoming HTTP request,
// i.e. we should not retry for longer than a well-chosen upper bound. Maybe ~1
// minute. Ideally less than 30 seconds or so. Also note that retries are done
// automatically for a range of transient issues: ETIMEDOUT ECONNRESET
// EADDRINUSE ECONNREFUSED EPIPE ENOTFOUND ENETUNREACH EAI_AGAIN
const GOT_JWKS_RETRY_OBJECT = {
  limit: 3,
  calculateDelay: customGotRetryfunc,
  statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
  // do not retry for longer than 60 seconds
  maxRetryAfter: 45 * 1000
};

const GOT_JWKS_OPTIONS = {
  retry: GOT_JWKS_RETRY_OBJECT,
  timeout: GOT_JWKS_HTTP_TIMEOUT_SETTINGS,
  throwHttpErrors: false
};

/**
 * Set newly fetched JWKS object. Rely on this being an atomic operation in the
 * runtime. Return the same object for convenience.
 */
function rememberNewJWKS(j: object): object {
  LAST_JWKS_POTENTIALLY_STALE = j;
  LAST_JWKS_SET_TIME = mtime();
  log.info(
    "JWKS fetcher: got fresh key set, stored as LAST_JWKS_POTENTIALLY_STALE"
  );
  return j;
}

function getPotantiallyStaleJWKS() {
  assert(LAST_JWKS_SET_TIME !== undefined);
  log.info(
    `JWKS fetcher: use potentially stale JWKS. Age: ${mtimeDiffSeconds(
      LAST_JWKS_SET_TIME
    ).toFixed(2)} `
  );
  return LAST_JWKS_POTENTIALLY_STALE;
}

export async function prepopulate(url: string) {
  FIRST_JWKS_FROM_PREPOPULATE_CALL = await fetch(url);
  log.info("JWKS prepopulation: done");
}

/** Start prepopulate() execution. Also return promise, but build this function
 * so that it is fine to not `await` this promise, i.e. to let this run as
 * 'zombie'
 *
 * - is expected to not throw an error of any kind (see over-generalized err
 *   handler)
 *
 * - is expected to do no harm: is expected to complete within an upper bound
 *   of time, determined by timeout constants and retrying machinery
 *
 * - if it succeeds before the actual login request great, job done, the first
 *   login request will likely use the cached JWKS key set.
 *
 * - if it fails before the actual login request: also OK, the JWKS is then
 *   attempted to be fetched during login request processing.
 */
export async function prepopulateZombie(url: string) {
  try {
    await prepopulate(url);
  } catch (err) {
    log.warning(`non-fatal: JWKS preopulation failed: ${err}`);
  }
}

export async function fetch(url: string) {
  if (FIRST_JWKS_FROM_PREPOPULATE_CALL) {
    log.info(
      "JWKS fetcher: first call after prepopulate, return FIRST_JWKS_FROM_PREPOPULATE_CALL"
    );
    // Important: reset to `undefined` so that this really is only used in the
    // _first_ call to jwksFetcher() that is _not_ from within prepopulate()
    const s = FIRST_JWKS_FROM_PREPOPULATE_CALL;
    FIRST_JWKS_FROM_PREPOPULATE_CALL = undefined;
    return s;
  }

  // Perform HTTP request -- this uses retrying (and logging), see above for
  // the corresponding parameters.
  log.info(`JWKS fetcher: start GET machinery with retrying. url: ${url}`);
  let resp: GotResponse<string> | undefined;
  const t0 = mtime();
  try {
    resp = await got(url, GOT_JWKS_OPTIONS);
  } catch (err) {
    log.warning(
      `JWKS fetcher: giving up HTTP GET after retrying, last error: ${err}`
    );
  }
  const dur = mtimeDiffSeconds(t0);
  log.info(`JWKS fetcher: got() call duration: ${dur.toFixed(3)} s`);

  if (resp === undefined) {
    if (LAST_JWKS_POTENTIALLY_STALE !== undefined) {
      return getPotantiallyStaleJWKS();
    }
    throw new Error(
      "JWKS fetcher: HTTP GET failed and LAST_JWKS_POTENTIALLY_STALE not set"
    );
  }

  // after retrying machinery we might still end up with e.g. a 504 response
  // as last response, not yet explicitly treated by code although the
  // JSON deser handler will catch that
  // TODO if (resp.code !== 200) { ... getPotantiallyStaleJWKS() ... }

  let newKeySet: object | undefined;
  try {
    newKeySet = JSON.parse(resp.body);
  } catch (err) {
    log.warning(`JWKS fetcher: JSON deserialization failed: ${err}`);
  }

  if (newKeySet !== undefined) {
    return rememberNewJWKS(newKeySet);
  }

  if (LAST_JWKS_POTENTIALLY_STALE !== undefined) {
    return getPotantiallyStaleJWKS();
  }

  throw new Error(
    "JWKS fetcher: request succeeded, deserialization failed, LAST_JWKS_POTENTIALLY_STALE not set"
  );
}