; ModuleID = 'scoring_io'
source_filename = "scoring.io"
target triple = "arm64-apple-darwin25.3.0"

@_yogi_scoring_io_weightedScore = global double 0.000000e+00
@_yogi_scoring_io_scorePercent = global double 0.000000e+00
@_yogi_scoring_io_hasEnoughScore = global i1 false
@0 = private unnamed_addr constant [11 x i8] c"scoring_io\00", align 1
@1 = private unnamed_addr constant [21 x i8] c"scoring.io:addWeight\00", align 1
@2 = private unnamed_addr constant [11 x i8] c"scoring.io\00", align 1
@3 = private unnamed_addr constant [11 x i8] c"scoring.io\00", align 1
@4 = private unnamed_addr constant [11 x i8] c"scoring_io\00", align 1
@5 = private unnamed_addr constant [13 x i8] c"$module.init\00", align 1
@6 = private unnamed_addr constant [11 x i8] c"scoring.io\00", align 1
@_yogi_metrics_io_rawScore = external global double
@_yogi_metrics_io_testCoverage = external global double
@_yogi_metrics_io_crashPenalty = external global double
@7 = private unnamed_addr constant [11 x i8] c"scoring.io\00", align 1
@_yogi_config_io_maxScore = external global double
@8 = private unnamed_addr constant [11 x i8] c"scoring.io\00", align 1
@_yogi_config_io_minDeployScore = external global double
@9 = private unnamed_addr constant [11 x i8] c"scoring_io\00", align 1
@10 = private unnamed_addr constant [16 x i8] c"$module.cleanup\00", align 1

define double @_yogi_fn_scoring_io_addWeight(double %input, double %weight) {
entry:
  %total = alloca double, align 8
  %weight2 = alloca double, align 8
  %input1 = alloca double, align 8
  call void @yogi_memory_push_context(ptr @0, ptr @1)
  store double %input, ptr %input1, align 8
  store double %weight, ptr %weight2, align 8
  call void @yogi_memory_push_source_location(ptr @2, i64 5, i64 9)
  %input.load = load double, ptr %input1, align 8
  %weight.load = load double, ptr %weight2, align 8
  %addtmp = fadd double %input.load, %weight.load
  call void @yogi_memory_pop_source_location()
  store double %addtmp, ptr %total, align 8
  call void @yogi_memory_push_source_location(ptr @3, i64 6, i64 5)
  %total.load = load double, ptr %total, align 8
  call void @yogi_memory_pop_source_location()
  call void @yogi_memory_pop_context()
  ret double %total.load
}

declare void @yogi_memory_push_context(ptr, ptr)

declare void @yogi_memory_push_source_location(ptr, i64, i64)

declare void @yogi_memory_pop_source_location()

declare void @yogi_memory_pop_context()

define void @_yogi_module_init_scoring_io() {
entry:
  call void @yogi_memory_push_context(ptr @4, ptr @5)
  call void @yogi_memory_push_source_location(ptr @6, i64 9, i64 12)
  %rawScore.load = load double, ptr @_yogi_metrics_io_rawScore, align 8
  %testCoverage.load = load double, ptr @_yogi_metrics_io_testCoverage, align 8
  %addtmp = fadd double %rawScore.load, %testCoverage.load
  call void @yogi_memory_pop_source_location()
  store double %addtmp, ptr @_yogi_scoring_io_weightedScore, align 8
  %weightedScore.load = load double, ptr @_yogi_scoring_io_weightedScore, align 8
  %crashPenalty.load = load double, ptr @_yogi_metrics_io_crashPenalty, align 8
  %subtmp = fsub double %weightedScore.load, %crashPenalty.load
  store double %subtmp, ptr @_yogi_scoring_io_weightedScore, align 8
  call void @yogi_memory_push_source_location(ptr @7, i64 12, i64 12)
  %weightedScore.load1 = load double, ptr @_yogi_scoring_io_weightedScore, align 8
  %maxScore.load = load double, ptr @_yogi_config_io_maxScore, align 8
  %multmp = fmul double %weightedScore.load1, %maxScore.load
  %divtmp = fdiv double %multmp, 1.000000e+02
  call void @yogi_memory_pop_source_location()
  store double %divtmp, ptr @_yogi_scoring_io_scorePercent, align 8
  call void @yogi_memory_push_source_location(ptr @8, i64 13, i64 12)
  %scorePercent.load = load double, ptr @_yogi_scoring_io_scorePercent, align 8
  %minDeployScore.load = load double, ptr @_yogi_config_io_minDeployScore, align 8
  %cmptmp = fcmp oge double %scorePercent.load, %minDeployScore.load
  call void @yogi_memory_pop_source_location()
  store i1 %cmptmp, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  call void @yogi_memory_pop_context()
  ret void
}

define void @_yogi_module_cleanup_scoring_io() {
entry:
  call void @yogi_memory_push_context(ptr @9, ptr @10)
  %0 = load double, ptr @_yogi_scoring_io_weightedScore, align 8
  store double 0.000000e+00, ptr @_yogi_scoring_io_weightedScore, align 8
  %1 = load double, ptr @_yogi_scoring_io_scorePercent, align 8
  store double 0.000000e+00, ptr @_yogi_scoring_io_scorePercent, align 8
  %2 = load i1, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  store i1 false, ptr @_yogi_scoring_io_hasEnoughScore, align 1
  call void @yogi_memory_pop_context()
  ret void
}
