/**
 * Copyright 2020 Opstrace, Inc.
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

import yaml from "js-yaml";

import { State } from "./reducer";
import { LatestControllerConfigType } from "@opstrace/controller-config";
import { Tenant, Tenants } from "@opstrace/tenants";
import { log } from "@opstrace/utils";

export { generateSecretValue } from "@opstrace/controller-config";

export const DEVELOPMENT = "development";
/**
 * currentVersion returns the version of this controller.
 * If running with --development, currentVersion will return "development"
 */
export const currentVersion = (): string =>
  process.env.STACK_VERSION || DEVELOPMENT;

/**
 * iAmDesiredVersion will return true if the version passed in is equal to the version of this controller instance.
 * If running in development, currentVersion will return DEVELOPMENT
 */
export const iAmDesiredVersion = (version: string | undefined): boolean => {
  if (currentVersion() === DEVELOPMENT) {
    return true;
  }
  return version === currentVersion();
};

export const getControllerConfig = (
  state: State
): LatestControllerConfigType => {
  if (state.config.config === undefined) {
    throw Error("Controller configmap is not present or missing fields");
  }
  return state.config.config;
};

// getControllerConfigOverrides checks if there's a ConfigMap named
// "opstrace-controller-config-overrides in the default namespace. If it exists
// then parses the `key` field and returns the corresponding object. If the
// ConfigMap does not exist it returns an empty object. If there's an error
// parsing the config overrides it logs the error and returns an empty object.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getControllerConfigOverrides(state: State, key: string): any {
  if (state.config.config === undefined) {
    throw Error("Controller configmap is not present or missing fields");
  }

  const cm = state.kubernetes.cluster.ConfigMaps.resources.find(
    cm =>
      cm.namespace === "default" &&
      cm.name === "opstrace-controller-config-overrides"
  );

  try {
    return yaml.load(cm?.spec.data?.[key] ?? "");
  } catch (e: any) {
    log.warning(`failed to parse config overrides: ${e.message}`);
    return {};
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getControllerCortexConfigOverrides = (state: State): any => {
  return getControllerConfigOverrides(state, "cortex");
};

// same as getControllerCortexConfigOverrides but for loki
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getControllerLokiConfigOverrides = (state: State): any => {
  return getControllerConfigOverrides(state, "loki");
};

export const toTenantNamespace = (tenantName: string): string =>
  `${tenantName}-tenant`;

/**
 * Searches tenants for the matching name, returns the ID.
 */
export const toTenantId = (
  tenantName: string,
  tenants: Tenants
): string | null => {
  const matches = tenants.filter(t => t.name === tenantName);
  if (matches.length == 1) {
    const match = matches[0];
    // ID may be missing if the tenant hasn't been synced to GraphQL yet
    // This should only happen on initial controller launch or if GraphQL isn't syncing
    return match.id ? match.id : null;
  } else if (matches.length > 1) {
    log.warning("found two tenants with same name=%s: %s", tenantName, matches);
  }
  return null;
};

/**
 * Searches tenants for the matching ID, returns the name.
 */
export const toTenantName = (
  tenantId: string,
  tenants: Tenants
): string | null => {
  const matches = tenants.filter(t => t.id === tenantId);
  if (matches.length == 1) {
    return matches[0].name;
  } else if (matches.length > 1) {
    log.warning("found two tenants with same id=%s: %s", tenantId, matches);
  }
  return null;
};

export const getTenantNamespace = (tenant: Tenant): string =>
  toTenantNamespace(tenant.name);

/**
 * Get the queue endpoint.
 */
export const getQueueEndpoint = (): string =>
  "kafka-kafka-bootstrap.kafka.svc.cluster.local:9092";

/**
 * getDomain returns the root domain for this stack
 * @param state
 */
export const getDomain = (state: State): string => {
  const stack = getControllerConfig(state);

  // TODO: consolidate this into _one_ parameter in the controller config,
  // containing the DNS name pointing to the opstrace instance, w/o trailing
  // dot.
  // so that here we only need to return _that_.

  if (stack.custom_dns_name !== undefined) {
    return stack.custom_dns_name;
  }

  // No custom DNS TLD/system provided,
  // stack.dnsName is, with current WIP code, always <instance_name>.opstrace.io
  // replace trailing dot if it's there.
  return `${stack.name}.${stack.dnsName.replace(/\.$/, "")}`;
};

export const getTenantDomain = (tenant: Tenant, state: State): string =>
  `${tenant.name}.${getDomain(state)}`;

export const getApiDomain = (
  api: string,
  tenant: Tenant,
  state: State
): string => `${api}.${getTenantDomain(tenant, state)}`;

export const getNodeCount = (state: State): number =>
  state.kubernetes.cluster.Nodes.resources.length;

export const getPrometheusName = (tenant: Tenant): string =>
  `${tenant.name}-prometheus`;

//
// Code below was extracted  from
// https://gist.github.com/mir4ef/c172583bdb968951d9e57fb50d44c3f7 to do deep
// object merging with typescript.
//
interface IIsObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (item: any): boolean;
}

interface IObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface IDeepMerge {
  (target: IObject, ...sources: Array<IObject>): IObject;
}

/**
 * @description Method to check if an item is an object. Date and Function are considered
 * an object, so if you need to exclude those, please update the method accordingly.
 * @param item - The item that needs to be checked
 * @return {Boolean} Whether or not @item is an object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isObject: IIsObject = (item: any): boolean => {
  return item === Object(item) && !Array.isArray(item);
};

/**
 * @description Method to perform a deep merge of objects
 * @param {Object} target - The targeted object that needs to be merged with the supplied @sources
 * @param {Array<Object>} sources - The source(s) that will be used to update the @target object
 * @return {Object} The final merged object
 */
export const deepMerge: IDeepMerge = (
  target: IObject,
  ...sources: Array<IObject>
): IObject => {
  // return the target if no sources passed
  if (!sources.length) {
    return target;
  }

  const result: IObject = target;

  if (isObject(result)) {
    const len: number = sources.length;

    for (let i = 0; i < len; i += 1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elm: any = sources[i];

      if (isObject(elm)) {
        for (const key in elm) {
          // eslint-disable-next-line no-prototype-builtins
          if (elm.hasOwnProperty(key)) {
            if (isObject(elm[key])) {
              if (!result[key] || !isObject(result[key])) {
                result[key] = {};
              }
              deepMerge(result[key], elm[key]);
            } else {
              if (Array.isArray(result[key]) && Array.isArray(elm[key])) {
                // concatenate the two arrays and remove any duplicate primitive values
                result[key] = Array.from(new Set(result[key].concat(elm[key])));
              } else {
                result[key] = elm[key];
              }
            }
          }
        }
      }
    }
  }

  return result;
};
//
// End of gist code.
//
