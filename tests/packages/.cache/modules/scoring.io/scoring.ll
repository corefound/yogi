; ModuleID = 'scoring_io'
source_filename = "scoring.io"
target triple = "arm64-apple-darwin25.3.0"

@_yogi_scoring_io_weightedScore = global double 0.000000e+00
@_yogi_scoring_io_scorePercent = global double 0.000000e+00
@_yogi_scoring_io_hasEnoughScore = global i1 false
@_yogi_metrics_io_rawScore = external global double
@_yogi_metrics_io_testCoverage = external global double
@_yogi_metrics_io_crashPenalty = external global double
@_yogi_config_io_maxScore = external global double
@_yogi_config_io_minDeployScore = external global double

define double @_yogi_fn_scoring_io_addWeight(double %input, double %weight) {
entry:
  %total = alloca double, align 8
  %weight2 = alloca double, align 8
  %input1 = alloca double, align 8
  store double %input, ptr %input1, align 8
  store double %weight, ptr %weight2, align 8
  %input.load = load double, ptr %input1, align 8
  %weight.load = load double, ptr %weight2, align 8
  %addtmp = fadd double %input.load, %weight.load
  store double %addtmp, ptr %total, align 8
  %total.load = load double, ptr %total, align 8
  ret double %total.load
}

define void @_yogi_module_init_scoring_io() {
entry:
  %rawScore.load = load double, ptr @_yogi_metrics_io_rawScore, align 8
  %testCoverage.load = load double, ptr @_yogi_metrics_io_testCoverage, align 8
  %addtmp = fadd double %rawScore.load, %testCoverage.load
  store double %addtmp, ptr @_yogi_scoring_io_weightedScore, align 8
  %weightedScore.load = load double, ptr @_yogi_scoring_io_weightedScore, align 8
  %crashPenalty.load = load double, ptr @_yogi_metrics_io_crashPenalty, align 8
  %subtmp = fsub double %weightedScore.load, %crashPenalty.load
  store double %subtmp, ptr @_yogi_scoring_io_weightedScore, align 8
  %weightedScore.load1 = load double, ptr @_yogi_scoring_io_weightedScore, align 8
  %maxScore.load = load double, ptr @_yogi_config_io_maxScore, align 8
  %multmp = fmul double %weightedScore.load1, %maxScore.load
  %divtmp = fdiv double %multmp, 1.000000e+02
  store double %divtmp, ptr @_yogi_scoring_io_scorePercent, align 8
  %scorePercent.load = load double, ptr @_yogi_scoring_io_scorePercent, align 8
  %minDeployScore.load = load double, ptr @_yogi_config_io_minDeployScore, align 8
  %cmptmp = fcmp oge double %scorePercent.load, %minDeployScore.load
  store i1 %cmptmp, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  ret void
}

define void @_yogi_module_cleanup_scoring_io() {
entry:
  %0 = load double, ptr @_yogi_scoring_io_weightedScore, align 8
  store double 0.000000e+00, ptr @_yogi_scoring_io_weightedScore, align 8
  %1 = load double, ptr @_yogi_scoring_io_scorePercent, align 8
  store double 0.000000e+00, ptr @_yogi_scoring_io_scorePercent, align 8
  %2 = load i1, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  store i1 false, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  ret void
}
