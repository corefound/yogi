.PHONY: all dev build

dev:
	@yarn --cwd ./yogi dev & yarn --cwd ./past dev & wait

add:
	yarn add ../past/corefound-past-0.0.1.tgz

build:
	@cd ./src/libs/llvm/build && rm -rf ./* 
	@cd ./src/libs/llvm && npx node-gyp configure
	@cd ./src/libs/llvm && npx node-gyp build