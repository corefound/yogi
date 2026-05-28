.PHONY: dev build


dev:
	@./bin/parser-macos-arm64 ./tests/main.io


build:
	@rm -rf dist
	@npx tsc
	@npx pkg dist/index.js \
		--targets node18-linux-x64,node18-macos-x64,node18-macos-arm64,node18-win-x64 \
		--output ./bin/parser
