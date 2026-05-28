# variable
.PHONY: run ts-build

# PATHS
COMPILER_PATH := $(CURDIR)/src/compiler 
TS_SOURCE_PATH := $(CURDIR)/tools/typescript

run: 
	$(TS_PATH)/ts-parser $(TS_PATH)/tests/main.io

compile: 
	@cd $(COMPILER_PATH) && npm run build
	@cd $(COMPILER_PATH) && npm run pkg


ts-build:
	@cd $(TS_SOURCE_PATH) && npm run build
	@cd $(COMPILER_PATH)/src/ts && rm -rf local
	@mv $(TS_SOURCE_PATH)/built/local $(COMPILER_PATH)/src/ts/local
