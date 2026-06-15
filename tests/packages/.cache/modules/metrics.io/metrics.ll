; ModuleID = 'metrics_io'
source_filename = "metrics.io"
target triple = "arm64-apple-darwin25.3.0"

@_yogi_metrics_io_rawScore = global double 0.000000e+00
@_yogi_metrics_io_testCoverage = global double 0.000000e+00
@_yogi_metrics_io_crashPenalty = global double 0.000000e+00

define void @_yogi_module_init_metrics_io() {
entry:
  store double 4.800000e+01, ptr @_yogi_metrics_io_rawScore, align 8
  store double 2.400000e+01, ptr @_yogi_metrics_io_testCoverage, align 8
  store double 6.000000e+00, ptr @_yogi_metrics_io_crashPenalty, align 8
  ret void
}

define void @_yogi_module_cleanup_metrics_io() {
entry:
  %0 = load double, ptr @_yogi_metrics_io_rawScore, align 8
  store double 0.000000e+00, ptr @_yogi_metrics_io_rawScore, align 8
  %1 = load double, ptr @_yogi_metrics_io_testCoverage, align 8
  store double 0.000000e+00, ptr @_yogi_metrics_io_testCoverage, align 8
  %2 = load double, ptr @_yogi_metrics_io_crashPenalty, align 8
  store double 0.000000e+00, ptr @_yogi_metrics_io_crashPenalty, align 8
  ret void
}
