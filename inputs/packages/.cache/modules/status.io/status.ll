; ModuleID = 'status_io'
source_filename = "status.io"
target triple = "arm64-apple-darwin25.3.0"

@0 = private unnamed_addr constant [10 x i8] c"status_io\00", align 1
@1 = private unnamed_addr constant [13 x i8] c"$module.init\00", align 1
@2 = private unnamed_addr constant [10 x i8] c"status_io\00", align 1
@3 = private unnamed_addr constant [16 x i8] c"$module.cleanup\00", align 1

define void @_yogi_module_init_status_io() {
entry:
  call void @yogi_memory_push_context(ptr @0, ptr @1)
  call void @yogi_memory_pop_context()
  ret void
}

declare void @yogi_memory_push_context(ptr, ptr)

declare void @yogi_memory_pop_context()

define void @_yogi_module_cleanup_status_io() {
entry:
  call void @yogi_memory_push_context(ptr @2, ptr @3)
  call void @yogi_memory_pop_context()
  ret void
}
