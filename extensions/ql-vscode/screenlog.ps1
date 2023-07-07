Write-Host "Starting to take periodic screenshots..."
for ($Elapsed = 0; $Elapsed -lt (20 * 60); $Elapsed += 30)
{
    $T = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
    Write-Host "Taking screenshot at ${Elapsed} seconds ('elapsed_${T}.png')"
    .\screenshot.bat "elapsed_${T}.png"
    Write-Host "Sleeping for 30 seconds..."
    Start-Sleep -Seconds 30
}
