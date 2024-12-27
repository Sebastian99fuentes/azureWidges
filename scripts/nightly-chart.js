VSS.init({
    explicitNotifyLoaded: true,  // Configura VSS para notificar manualmente cuando la carga del widget esté completa.
    usePlatformStyles: true      // Usa estilos de plataforma para que el widget se adapte al diseño de Azure DevOps.
});

VSS.require(["TFS/Dashboards/WidgetHelpers"], function (WidgetHelpers) {
    VSS.register("nightly-chart", function () {  // Registra el widget con el ID "".
        return {
            load: function (widgetSettings) {  // Define la lógica para cargar el widget.
                const settings = JSON.parse(widgetSettings.customSettings.data);  // Obtiene la configuración personalizada del widget.
                const tokenPromise = VSS.getAccessToken();  // Obtiene un token de acceso para las API de Azure DevOps.

                // Verifica si faltan configuraciones necesarias para operar.
                if (!settings || !settings.pipeline ) {
                    showConfigureWidget(widgetSettings);  // Muestra la interfaz de configuración si faltan datos.
                    return WidgetHelpers.WidgetStatusHelper.Success();  // Notifica que el widget se cargó correctamente, aunque esté en modo de configuración.
                }

                // Extrae los valores necesarios de la configuración del widget.
                const { pipeline} = settings;
                const projectName = VSS.getWebContext().project.name;  // Obtiene el nombre del proyecto.
                const organization = VSS.getWebContext().account.name;  // Obtiene el nombre de la organización.


               const runId = getLatestRunId(pipeline);

                // Usa el token para buscar los datos del artifact y mostrarlos en el widget.
                tokenPromise
                    .then(tokenObject => fetchArtifactData(tokenObject.token, projectName, organization, pipeline, runId))
                    .then(linesOfCode => {
                        // Actualiza el contenido del widget con las líneas de código extraídas.
                        document.getElementById("code-lines-count").innerText = linesOfCode;
                    })
                    .catch(err => console.error("Error fetching artifact data:", err));  // Maneja errores al obtener datos.

                return WidgetHelpers.WidgetStatusHelper.Success();  // Notifica que el widget se cargó exitosamente.
            }
        };
    });

    VSS.notifyLoadSucceeded();  // Notifica a Azure DevOps que el widget se cargó completamente.
});


function showConfigureWidget(widgetSettings, dashboardServices, widgetHelpers) {
    $('#Configure-Widget').css('display', 'block');
    var height = 70;
    if(widgetSettings.size.rowSpan == 3) {
        height = 150;
    }
    $('#Configure-Widget-Text').css('margin-top', height + 'px');

    dashboardServices.WidgetHostService.getService().then((DashboardServiceHost) => {
        DashboardServiceHost.showConfiguration() // This is what you want to hook up to your onClick event to show the widget configuration modal.
    });
    return widgetHelpers.WidgetStatusHelper.Unconfigured();
}



function fetchArtifactData(token, projectName, organization, pipelineId, runId ) {
    const url = `https://dev.azure.com/${organization}/${projectName}/_apis/pipelines/${pipelineId}/runs/${runId}/artifacts?api-version=7.1-preview.1`;

    return fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,  // Autoriza la solicitud con el token de acceso.
            'Content-Type': 'application/json'  // Define el tipo de contenido esperado.
        }
    })
        .then(response => response.json())  // Convierte la respuesta en formato JSON.
        .then(data => {
            const artifact = data.value.find(a => a.name === artifactName);  // Busca el artifact por su nombre.
            if (!artifact) {
                throw new Error(`Artifact "${artifactName}" not found in pipeline run.`);  // Lanza un error si no se encuentra el artifact.
            }
            return fetchArtifactContent(token, artifact.resource.downloadUrl);  // Obtiene el contenido del artifact.
        });
}


function fetchArtifactContent(token, artifactDownloadUrl) {
    return fetch(artifactDownloadUrl, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token  // Autoriza la descarga con el token de acceso.
        }
    })
        .then(response => response.text())  // Convierte la respuesta en texto plano.
        .then(content => parseArtifactContent(content));  // Procesa el contenido del artifact.
}

function parseArtifactContent(content) {
    // Supongamos que el artifact es un archivo JSON con la estructura { "linesOfCode": 12345 }
    const parsed = JSON.parse(content);
    return parsed.linesOfCode;
}


function getLatestRunId(pipelineId) {
    return VSS.getAccessToken()
        .then(function(tokenObject) {
            var token = tokenObject.token;
            var projectName = VSS.getWebContext().project.name;
            var organization = VSS.getWebContext().account.name;
            var url = `https://dev.azure.com/${organization}/${projectName}/_apis/pipelines/${pipelineId}/runs?api-version=7.1`;

            return fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => data.value[0].id); // Devuelve el ID de la ejecución más reciente.
        });
}
