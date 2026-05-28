# variable
.PHONY: run ts-build

run: 
	/Users/brayhandeaza/Documents/dev/projects/ts-bk/yogi/src/compiler/bin/parser-macos-arm64 /Users/brayhandeaza/Documents/dev/projects/ts-bk/yogi/tests/main.io

compile: 
	@cd $(CURDIR)/src/compiler && npm run build
	@cd $(CURDIR)/src/compiler && npm run pkg

ts-build:
	@cd $(CURDIR)/tools/typescript && npm run build
	@cd $(CURDIR)/src/compiler/src/ts && rm -rf local
	@mv $(CURDIR)/tools/typescript/built/local $(CURDIR)/src/compiler/src/ts/local