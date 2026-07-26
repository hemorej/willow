$CREATE_RELEASE()

cd $FORGE_RELEASE_DIRECTORY

$PNPM_PATH install --frozen-lockfile

ln -s /mnt/$VOLUME_NAME/willowfonts public/fonts

$PNPM_PATH build

$ACTIVATE_RELEASE()

sudo supervisorctl restart daemon-910985:daemon-910985_00
