FROM ollama/ollama:latest

# Default model can be overridden via env at runtime
ENV OLLAMA_MODEL=gpt-oss:20b

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 11434
ENTRYPOINT ["/entrypoint.sh"]

