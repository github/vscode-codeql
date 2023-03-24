FROM --platform=linux/amd64 codercom/code-server:latest

RUN apt-get update && apt-get install -y wget
RUN wget https://github.com/github/codeql-action/releases/latest/download/codeql-bundle-linux64.tar.gz
RUN apt-get install -y tar
RUN tar -xvzf ./codeql-bundle-linux64.tar.gz
RUN codeql/codeql --version