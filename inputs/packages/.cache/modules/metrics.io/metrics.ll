; ModuleID = 'metrics_io'
source_filename = "metrics.io"
target triple = "arm64-apple-darwin25.3.0"

@_yogi_metrics_io_rawScore = global double 0.000000e+00
@_yogi_metrics_io_testCoverage = global double 0.000000e+00
@_yogi_metrics_io_crashPenalty = global double 0.000000e+00
@0 = private unnamed_addr constant [11 x i8] c"metrics_io\00", align 1
@1 = private unnamed_addr constant [13 x i8] c"$module.init\00", align 1
@2 = private unnamed_addr constant [11 x i8] c"metrics.io\00", align 1
@3 = private unnamed_addr constant [11 x i8] c"metrics.io\00", align 1
@4 = private unnamed_addr constant [11 x i8] c"metrics.io\00", align 1
@5 = private unnamed_addr constant [11 x i8] c"metrics_io\00", align 1
@6 = private unnamed_addr constant [16 x i8] c"$module.cleanup\00", align 1

define void @_yogi_module_init_metrics_io() {
entry:
  call void @yogi_memory_push_context(ptr @0, ptr @1)
  call void @yogi_memory_push_source_location(ptr @2, i64 1, i64 12)
  call void @yogi_memory_pop_source_location()
  store double 4.800000e+01, ptr @_yogi_metrics_io_rawScore, align 8
  call void @yogi_memory_push_source_location(ptr @3, i64 2, i64 12)
  call void @yogi_memory_pop_source_location()
  store double 2.400000e+01, ptr @_yogi_metrics_io_testCoverage, align 8
  call void @yogi_memory_push_source_location(ptr @4, i64 3, i64 12)
  call void @yogi_memory_pop_source_location()
  store double 6.000000e+00, ptr @_yogi_metrics_io_crashPenalty, align 8
  call void @yogi_memory_pop_context()
  ret void
}

declare void @yogi_memory_push_context(ptr, ptr)

declare void @yogi_memory_push_source_location(ptr, i64, i64)

declare void @yogi_memory_pop_source_location()

declare void @yogi_memory_pop_context()

define void @_yogi_module_cleanup_metrics_io() {
entry:
  call void @yogi_memory_push_context(ptr @5, ptr @6)
  %0 = load double, ptr @_yogi_metrics_io_rawScore, align 8
  store double 0.000000e+00, ptr @_yogi_metrics_io_rawScore, align 8
  %1 = load double, ptr @_yogi_metrics_io_testCoverage, align 8
  store double 0.000000e+00, ptr @_yogi_metrics_io_testCoverage, align 8
  %2 = load double, ptr @_yogi_metrics_io_crashPenalty, align 8
  store double 0.000000e+00, ptr @_yogi_metrics_io_crashPenalty, align 8
  call void @yogi_memory_pop_context()
  ret void
}
