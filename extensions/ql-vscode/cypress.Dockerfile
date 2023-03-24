FROM --platform=linux/amd64 codercom/code-server:latest

RUN sudo apt-get update

# # Download the codeql bundle
# RUN sudo apt-get install -y wget
# RUN wget https://github.com/github/codeql-action/releases/latest/download/codeql-bundle-linux64.tar.gz
# RUN sudo apt-get install -y tar
# RUN tar -xvzf ./codeql-bundle-linux64.tar.gz

# # Add codeql to the path
# RUN export PATH="$HOME/codeql:$PATH"

# Run a command to trigger codeql
# RUN codeql resolve packages

# Install the gh CLI
RUN type -p curl >/dev/null || (sudo apt update && sudo apt install curl -y)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
&& sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
&& sudo apt update \
&& sudo apt install gh -y

# Install the CodeQL extension
RUN gh extensions install github/gh-codeql

# First command starts the download of the CodeQL CLI
RUN gh codeql version

# Make codeql visible to VSCode by using https://github.com/github/gh-codeql#codeql-stub, since VS Code expects an executable called codeql instead of gh codeql
RUN gh codeql install-stub ~/.local/bin/

# Test that we can use codeql directly
RUN codeql resolve packages
