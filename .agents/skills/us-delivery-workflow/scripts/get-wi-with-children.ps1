# Obtém uma User Story e todas as suas Tasks filhas do Azure DevOps
param(
    [int]$WorkItemId = 0,
    [string]$OutputPath = ""
)

# Buffer de saída: quando -OutputPath é informado, grava num arquivo UTF-8;
# caso contrário, escreve no host (comportamento original).
$script:Out = [System.Collections.Generic.List[string]]::new()
function Emit([string]$line = "") { $script:Out.Add($line) }

$agentsDir = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$configPath = Join-Path $agentsDir "azure-devops.config.json"
$secretPath = Join-Path $agentsDir "azure-devops.secret"

if (-not (Test-Path $configPath)) {
    Write-Error "Crie .agents/azure-devops.config.json com organization e project"
    exit 1
}
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$pat = $env:AZURE_DEVOPS_PAT
if (-not $pat -and (Test-Path $secretPath)) { $pat = (Get-Content $secretPath -Raw).Trim() }
if (-not $pat) {
    Write-Error "Defina AZURE_DEVOPS_PAT ou crie .agents/azure-devops.secret"
    exit 1
}
$base64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$pat"))
$headers = @{ Authorization = "Basic $base64"; "Content-Type" = "application/json"; Accept = "application/json; api-version=7.1" }

$org = $config.organization
$project = $config.project

# 1. Buscar WI principal com relations
$uri = "https://dev.azure.com/$org/$project/_apis/wit/workitems/$WorkItemId" + "?%24expand=Relations&api-version=7.1"
$story = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get

# Extrair IDs das tasks filhas (rel = Hierarchy-Forward significa que o link aponta para o filho)
$childIds = @()
if ($story.relations) {
    foreach ($rel in $story.relations) {
        if ($rel.rel -match "Hierarchy-Forward") {
            $id = [int]($rel.url -split "/")[-1]
            $childIds += $id
        }
    }
}

# 2. Buscar cada task filha
$tasks = @()
if ($childIds.Count -gt 0) {
    $idsParam = $childIds -join ","
    $batchUri = "https://dev.azure.com/$org/$project/_apis/wit/workitems?ids=$idsParam&api-version=7.1"
    $batch = Invoke-RestMethod -Uri $batchUri -Headers $headers -Method Get
    $tasks = $batch.value
}

# 3. Saída formatada
Emit "=== USER STORY #$($story.id) ==="
Emit "Titulo: $($story.fields.'System.Title')"
Emit "Tipo: $($story.fields.'System.WorkItemType')"
Emit "Estado: $($story.fields.'System.State')"
Emit "Atribuido: $(if ($story.fields.'System.AssignedTo') { $story.fields.'System.AssignedTo'.displayName } else { '-' })"
if ($story.fields.'System.Description') {
    Emit "Descricao: $($story.fields.'System.Description')"
}
if ($story.fields.'Microsoft.VSTS.Common.AcceptanceCriteria') {
    Emit "Criterios de Aceitacao: $($story.fields.'Microsoft.VSTS.Common.AcceptanceCriteria')"
}
Emit ""

$i = 1
foreach ($t in $tasks) {
    $f = $t.fields
    Emit "--- TASK #$($f.'System.Id') ($i de $($tasks.Count)) ---"
    Emit "Titulo: $($f.'System.Title')"
    Emit "Estado: $($f.'System.State')"
    Emit "Atribuido: $(if ($f.'System.AssignedTo') { $f.'System.AssignedTo'.displayName } else { '-' })"
    if ($f.'System.Description') {
        Emit "Descricao: $($f.'System.Description')"
    }
    Emit ""
    $i++
}

# 4. Destino da saída
if ($OutputPath) {
    $dir = Split-Path -Parent $OutputPath
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $script:Out -join [Environment]::NewLine | Out-File -FilePath $OutputPath -Encoding utf8
    Write-Output "Snapshot gravado em: $OutputPath"
}
else {
    $script:Out | ForEach-Object { Write-Output $_ }
}
