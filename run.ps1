$containerName = "sealfx"
if (docker container inspect $containerName 2>$null) {
    Write-Host "container $containerName exists; removing it"
    docker rm -f $containerName
    docker image prune -f
}

# some env vars are only available server-side (e.g. AUTH_SECRET)
# so we need to pass them in via --env-file
docker run -d `
    --name $containerName `
    -p "9997:9997" `
    --env-file .env.local `
    "sealfx:latest"

if ($LASTEXITCODE -eq 0) {
    Write-Output "container started successfully."
} else {
    Write-Error "docker run failed with exit code: $LASTEXITCODE"
}

docker logs $containerName