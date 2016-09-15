#
# Vars, Tools, Files, Flags
#
JS_FILES	:= $(shell find bin lib test tools -name '*.js')
JSL_CONF_NODE	 = tools/jsl.node.conf
JSL_FILES_NODE	 = $(JS_FILES)
JSSTYLE_FILES	 = $(JS_FILES)
JSSTYLE_FLAGS	 = -f tools/jsstyle.conf
CLEAN_FILES += ./node_modules

include ./tools/mk/Makefile.defs

#
# Targets
#
.PHONY: all
all:
	npm install

.PHONY: test
test:
	./node_modules/mocha/bin/mocha -b 

.PHONY: git-hooks
git-hooks:
	ln -sf ../../tools/pre-commit.sh .git/hooks/pre-commit

include ./tools/mk/Makefile.deps
include ./tools/mk/Makefile.targ
JSL_FLAGS += --nofilelist
