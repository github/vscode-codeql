Write-Host "Starting to take periodic screenshots..."
for ($Elapsed = 0; $Elapsed -lt (20 * 60); $Elapsed += 30)
{
    Write-Host "Taking screenshot at ${Elapsed} seconds ('elapsed_${Elapsed}.png')"
    .\screenshot.bat "elapsed_${Elapsed}.png"
    Write-Host "Sleeping for 30 seconds..."
    Start-Sleep -Seconds 30
}
