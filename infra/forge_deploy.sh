$CREATE_RELEASE()

cd $FORGE_RELEASE_DIRECTORY

$pnpm_path install --frozen-lockfile

ln -s /mnt/volume-tor1-01/bdi2fonts public/fonts

$pnpm_path build

$ACTIVATE_RELEASE()

sudo supervisorctl restart daemon-916152:daemon-916152_00
