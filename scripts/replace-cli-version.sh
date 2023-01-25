#!/bin/bash

VERSIONS=$(gh api -H "Accept: application/vnd.github+json" /repos/github/codeql-cli-binaries/releases | jq -r '.[].tag_name' | head -2)

# we are exporting these variables so that we can access these variables in the workflow
LATEST_VERSION=$(echo $VERSIONS | awk '{ print $1 }')
PREVIOUS_VERSION=$(echo $VERSIONS | awk '{ print $2 }')

echo "LATEST_VERSION=$LATEST_VERSION" >> $GITHUB_ENV
echo "PREVIOUS_VERSION=$PREVIOUS_VERSION" >> $GITHUB_ENV

sed -i "s/$PREVIOUS_VERSION/$LATEST_VERSION/g" extensions/ql-vscode/supported_cli_versions.json
