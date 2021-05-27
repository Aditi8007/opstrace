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

import React, { useMemo } from "react";
import { useHistory } from "react-router-dom";
import { format, parseISO } from "date-fns";

import { installedIntegrationsPath } from "client/integrations/paths";
import { grafanaUrl } from "client/utils/grafana";

import Status from "client/integrations/exporterCloudWatch/Status";
import { Actions } from "./Actions";

import { CondRender } from "client/utils/rendering";

import { Box } from "client/components/Box";
import Attribute from "client/components/Attribute";
import { Card, CardContent, CardHeader } from "client/components/Card";
import { Button } from "client/components/Button";

import { ExternalLink } from "client/components/Link";
import { ArrowLeft } from "react-feather";
import { useSelectedTenantWithFallback } from "state/tenant/hooks/useTenant";
import { useSelectedIntegration } from "state/integration/hooks";
import { integrationDefRecords } from "client/integrations";

export const ExporterCloudWatchShow = () => {
  const history = useHistory();
  const tenant = useSelectedTenantWithFallback();
  const integration = useSelectedIntegration();

  const [isDashboardInstalled, grafanaFolderPath] = useMemo(() => {
    const latestMetadata = integration?.grafana_metadata;

    return [
      latestMetadata?.folder_path !== undefined,
      latestMetadata?.folder_path
    ];
  }, [integration?.grafana_metadata]);

  // NOTE: the timeranges for these urls is not the same as that used by the status component
  // const errorLogsUrl = useMemo(() => {
  //   const path = `orgId=1&left=%5B%22now-1h%22,%22now%22,%22logs%22,%7B%22expr%22:%22%7Bk8s_namespace_name%3D%5C%22${tenant.name}-tenant%5C%22,k8s_container_name%3D%5C%22exporter%5C%22,k8s_pod_name%3D~%5C%22%5Eexporter-${integration.key}-%5Ba-z0-9-%5D*%5C%22%7D%20%7C%3D%20%5C%22stderr%5C%22%20%7C%3D%20%5C%22${ERROR_STR}%5C%22%22%7D%5D`;
  //   return `${window.location.protocol}//system.${window.location.host}/grafana/explore?${path}`;
  // }, [tenant.name, integration.key]);

  const logsUrl = useMemo(() => {
    if (integration?.key) {
      const path = `orgId=1&left=%5B%22now-1h%22,%22now%22,%22logs%22,%7B%22expr%22:%22%7Bk8s_namespace_name%3D%5C%22${tenant.name}-tenant%5C%22,k8s_container_name%3D%5C%22exporter%5C%22,k8s_pod_name%3D~%5C%22%5Eexporter-${integration.key}-%5Ba-z0-9-%5D*%5C%22%7D%22%7D%5D`;
      return `${window.location.protocol}//system.${window.location.host}/grafana/explore?${path}`;
    } else return "";
  }, [tenant.name, integration?.key]);

  if (!integration) {
    // TODO: add loading or NotFound here
    return null;
  }

  const integrationDef = integrationDefRecords[integration.kind];

  return (
    <>
      <Box width="100%" height="100%" p={1}>
        <Box mb={2}>
          <Button
            size="small"
            startIcon={<ArrowLeft />}
            onClick={() => history.push(installedIntegrationsPath({ tenant }))}
          >
            Installed Integrations
          </Button>
        </Box>
        <Card>
          <CardHeader
            avatar={
              <img src={integrationDef.Logo} width={80} height={80} alt="" />
            }
            titleTypographyProps={{ variant: "h1" }}
            title={integration.name}
            action={
              <Box ml={3} display="flex" flexWrap="wrap">
                <Box p={1}>
                  <Status integration={integration} tenant={tenant} />
                </Box>
              </Box>
            }
          />
          <CardContent>
            <Box display="flex">
              <Box display="flex" flexDirection="column">
                <Attribute.Key>Integration:</Attribute.Key>
                <Attribute.Key>Created:</Attribute.Key>
                <CondRender when={isDashboardInstalled}>
                  <Attribute.Key> </Attribute.Key>
                </CondRender>
              </Box>
              <Box display="flex" flexDirection="column" flexGrow={1}>
                <Attribute.Value>{integrationDef.label}</Attribute.Value>
                <Attribute.Value>
                  {format(parseISO(integration.created_at), "Pppp")}
                </Attribute.Value>
              </Box>
              <Attribute.Key>
                <ExternalLink target="_blank" href={logsUrl}>
                  <Button state="primary" variant="outlined" size="medium">
                    View Exporter Logs
                  </Button>
                </ExternalLink>
              </Attribute.Key>
              <CondRender when={isDashboardInstalled}>
                <Attribute.Key>
                  <ExternalLink
                    target="_blank"
                    href={`${grafanaUrl({ tenant })}${grafanaFolderPath}`}
                  >
                    <Button state="primary" variant="outlined" size="medium">
                      View Grafana Dashboards
                    </Button>
                  </ExternalLink>
                </Attribute.Key>
              </CondRender>
            </Box>
          </CardContent>
        </Card>
      </Box>
      <Actions integration={integration} tenant={tenant} />
    </>
  );
};

export default ExporterCloudWatchShow;