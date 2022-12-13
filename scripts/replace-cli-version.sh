#!/bin/bash

VERSIONS=$(gh api -H "Accept: application/vnd.github+json" /repos/github/codeql-cli-binaries/releases | jq '.[].tag_name' | head -2)

LATEST_VERSION=$(echo $VERSIONS | awk '{ print $1 }' | sed "s/\"//g")
PREVIOUS_VERSION=$(echo $VERSIONS | awk '{ print $2 }' | sed "s/\"//g")

sed -i "s/$PREVIOUS_VERSION/$LATEST_VERSION/g" .github/workflows/main.yml
sed -i "s/$PREVIOUS_VERSION/$LATEST_VERSION/g" extensions/ql-vscode/src/vscode-tests/ensureCli.ts
