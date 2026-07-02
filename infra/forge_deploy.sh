$CREATE_RELEASE()

cd $FORGE_RELEASE_DIRECTORY

pnpm install --frozen-lockfile
pnpm run build
pnpm prune --prod

ln -s /mnt/volume-tor1-01/bdi2-results results
ln -s /mnt/volume-tor1-01/bdi2fonts public/fonts

$ACTIVATE_RELEASE()
