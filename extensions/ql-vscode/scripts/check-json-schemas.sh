#!/bin/bash
set -eu

# Sanity check that repo is clean to start with
if [ ! -z "$(git status --porcelain)" ]; then
    # If we get a fail here then this workflow needs attention...
    >&2 echo "Failed: Repo should be clean before testing!"
    exit 1
fi

# Generate the JSON schema files
npm run generate:schemas

# Check that repo is still clean
if [ ! -z "$(git status --porcelain)" ]; then
    # If we get a fail here then the PR needs attention
    >&2 echo "Failed: JSON schema files are not up to date. Run 'script/generate-json-schemas' to update"
    git status
    exit 1
fi
echo "Success: JSON schema files are up to date"
