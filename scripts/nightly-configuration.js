// Inicializa la extensión de VSS con notificación explícita de carga y estilos compatibles con la plataforma.
VSS.init({                        
    explicitNotifyLoaded: true,
    usePlatformStyles: true
}); 
// Carga la dependencia de WidgetHelpers y configura el widget.
VSS.require("TFS/Dashboards/WidgetHelpers","TFS/Dashboards/Services", function (WidgetHelpers) {
    // Incluye estilos de configuración estándar para widgets.
   WidgetHelpers.IncludeWidgetConfigurationStyles();
   // Registra la configuración del widget bajo el nombre "nightly-chart.Configuration".
   VSS.register("nightly-chart.Configuration", function () {   
       return {
            // Función que se ejecuta al cargar el widget.
           load: function (widgetSettings, widgetConfigurationContext) {
                // Obtiene la configuración personalizada del widget si existe.
               var settings = JSON.parse(widgetSettings.customSettings.data);
               // Referencias a los menús desplegables en el HTML.
               var $repositoryDropdown = $("#repository-dropdown");
               var $branchDropdown = $("#branch-dropdown");
               var $pipelineDropdown = $("#pipeline-dropdown");

               // Llama a la función para cargar los repositorios y llenar el menú desplegable.
              
               let repositoryPromise = getRepositoryData()
               .then(repos => {
                   repos.forEach(repo => {
                       var option = document.createElement('option');
                       option.text = repo.name;
                       option.value = repo.id;
                       $repositoryDropdown.append(option); // Agrega cada repositorio como opción.
                   });
               });
               

               // Maneja el evento de cambio del menú de repositorios.
               $repositoryDropdown.change(function() {
                   var selectedRepositoryId = this.value; // Obtiene el ID del repositorio seleccionado.
                   if (!selectedRepositoryId) {
                       return; // Si no hay selección, termina aquí.
                   }
                   $branchDropdown.find('option:not(:first)').remove(); // Limpia las opciones existentes en el menú de ramas.
                   // Llama a la función para cargar las ramas del repositorio seleccionado.
                   getBranchData(selectedRepositoryId)
                       .then(branches => {
                           branches.forEach(branch => {
                               var option = document.createElement('option');
                               option.text = branch.name;
                               option.value = branch.id;
                               // Selecciona automáticamente la rama si coincide con la configuración previa.
                               if (settings && branch.id == settings.branch) {
                                   option.selected = true;
                               }
                               $branchDropdown.append(option); // Agrega la rama al menú desplegable.
                           });
                       });
               });

                // Llama a la función para cargar los pipelines y llenar el menú desplegable.
                let pipelinePromise = getPipelineData()
                .then(pipelines => {
                    pipelines.forEach(pipeline => {
                        var option = document.createElement('option');
                        option.text = pipeline.name;
                        option.value = pipeline.id;
                        $pipelineDropdown.append(option); // Agrega cada pipeline como opción.
                    });
                });         

               $branchDropdown.on("change", function () {
                   notifyConfigurationChange(WidgetHelpers, widgetConfigurationContext, $branchDropdown, $repositoryDropdown, $pipelineDropdown, $artifactDropdown);
               });               // Maneja el evento de cambio del menú de pipelines.
               $pipelineDropdown.on("change", function () {
                notifyConfigurationChange(WidgetHelpers, widgetConfigurationContext, $branchDropdown, $repositoryDropdown, $pipelineDropdown, $artifactDropdown);
            });


               

               // Dropboxes are populated with data from the configuration.
               Promise.all([repositoryPromise, pipelinePromise]).then(() => {
                   if (settings && settings.repository) {
                       $repositoryDropdown.val(settings.repository);
                   }
                   if (settings && settings.pipeline) {
                       $pipelineDropdown.val(settings.pipeline);
                   }
                   $repositoryDropdown.trigger('change');
               });
               

               return WidgetHelpers.WidgetStatusHelper.Success();
           },

            // Función que se ejecuta al guardar la configuración.
           onSave: function() {
                // Obtiene las referencias a los menús desplegables.
               var $repositoryDropdown = $("#repository-dropdown");
               var $branchDropdown = $("#branch-dropdown");
               var $pipelineDropdown = $("#pipeline-dropdown");
            //    var $artifactDropdown = $("#artifact-dropdown");
               // Crea un objeto con los valores seleccionados en los menús.
               var customSettings = {
                   data: JSON.stringify({
                       branch: $branchDropdown.val(),
                       repository: $repositoryDropdown.val(),
                       pipeline: $pipelineDropdown.val(),
                    //    artifact: $artifactDropdown.val()
                   })
               };
               // Retorna los ajustes personalizados como válidos para el widget.
               return WidgetHelpers.WidgetConfigurationSave.Valid(customSettings);  
           }
       }
   });
   VSS.notifyLoadSucceeded();
});

// Función para notificar cambios en la configuración.
function notifyConfigurationChange(widgetHelpers, widgetConfigurationContext, branchDropdown, repositoryDropdown) {
    var customSettings = 
    {
        data: JSON.stringify(
            {
                branch: branchDropdown.val(), 
                repository: repositoryDropdown.val(), 
    
            })
    };
     // Crea un evento de cambio de configuración y lo notifica al contexto.
    var eventName = widgetHelpers.WidgetEvent.ConfigurationChange;
    var eventArgs = widgetHelpers.WidgetEvent.Args(customSettings);
    widgetConfigurationContext.notify(eventName, eventArgs);
}

function getPipelineData() {
    return VSS.getAccessToken()
        .then(function(tokenObject) {
            var token = tokenObject.token;
            var projectName = VSS.getWebContext().project.name;
            var organization = VSS.getWebContext().account.name;
            var url = `https://dev.azure.com/${organization}/${projectName}/_apis/pipelines?api-version=7.1`;
            return fetch(url, 
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => data.value.map(pipeline => ({name: pipeline.name, id: pipeline.id})))
            .then(pipelines => pipelines.sort((a, b) => a.name.localeCompare(b.name)));
        });
}

function getBranchData(repositoryId) {
    return VSS.getAccessToken()
        .then(function(tokenObject) {
            var token = tokenObject.token;
            var projectName = VSS.getWebContext().project.name;
            var organization = VSS.getWebContext().account.name;
            var url = `https://dev.azure.com/${organization}/${projectName}/_apis/git/repositories/${repositoryId}/refs?filter=heads&api-version=6.0`;
            return fetch(url, 
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => data.value.map(branch => ({name: branch.name.replace('refs/heads/', ''), id: branch.name})))
            .then(branches => branches.sort((a, b) => a.name.localeCompare(b.name)));
        });
}

function getRepositoryData() {
    return VSS.getAccessToken()
        .then(function(tokenObject) {
            var token = tokenObject.token;
            var projectName = VSS.getWebContext().project.name;
            var organization = VSS.getWebContext().account.name;
            var url = `https://dev.azure.com/${organization}/${projectName}/_apis/git/repositories?api-version=6.0`;
            return fetch(url, 
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => data.value.map(repo => ({name: repo.name, id: repo.id})))
            .then(repos => repos.sort((a, b) => a.name.localeCompare(b.name)));
        });
}


function getArtifactData(pipelineId, runId) {
    return VSS.getAccessToken()
        .then(function(tokenObject) {
            var token = tokenObject.token;
            var projectName = VSS.getWebContext().project.name;
            var organization = VSS.getWebContext().account.name;
            var url = `https://dev.azure.com/${organization}/${projectName}/_apis/pipelines/${pipelineId}/runs/${runId}/artifacts?api-version=7.1-preview.1`;
            return fetch(url, 
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            })
            .then(response => response.json())
            .then(data => data.value.map(artifact => ({name: artifact.name, id: artifact.name}))) // `id` es el nombre aquí porque no hay un ID único.
            .then(artifacts => artifacts.sort((a, b) => a.name.localeCompare(b.name)));
        });
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
