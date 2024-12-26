FROM codercom/code-server:4.96.2

USER root

RUN apt-get update \
  && apt-get install -y \
    unzip \
  && rm -rf /var/lib/apt/lists/*

RUN wget -q -O /tmp/codeql.zip https://github.com/github/codeql-cli-binaries/releases/latest/download/codeql-linux64.zip \
  && unzip -q /tmp/codeql.zip -d /opt \
  && rm -rf /tmp/codeql.zip

ENV PATH="/opt/codeql:${PATH}"

USER 1000
