FROM codercom/code-server:4.20.0

USER root

RUN apt-get update \
  && apt-get install -y \
    unzip \
  && rm -rf /var/lib/apt/lists/*

RUN wget -O /tmp/codeql.zip https://github.com/github/codeql-cli-binaries/releases/download/v2.15.5/codeql-linux64.zip \
  && unzip /tmp/codeql.zip -d /usr/local/bin \
  && rm -rf /tmp/codeql.zip

ENV PATH="/usr/local/bin/codeql:${PATH}"

USER 1000
