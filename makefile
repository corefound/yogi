# variable
.PHONY: run

TS_PATH := $(CURDIR)/src/ts

run: 
	$(TS_PATH)/ts-parser $(TS_PATH)/tests/main.io