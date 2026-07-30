if(NOT DEFINED YOGI_PROGRAM_TRACE_ANALYZER OR YOGI_PROGRAM_TRACE_ANALYZER STREQUAL "")
	message(FATAL_ERROR "YOGI_PROGRAM_TRACE_ANALYZER is required")
endif()

if(NOT DEFINED TEST_WORK_DIR OR TEST_WORK_DIR STREQUAL "")
	message(FATAL_ERROR "TEST_WORK_DIR is required")
endif()

file(REMOVE_RECURSE "${TEST_WORK_DIR}")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}/valid")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}/invalid")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}/invalid-decision")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}/invalid-cleanup")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}/invalid-ir")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}/invalid-lost-cleanup")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}/invalid-duplicate-cleanup")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}/invalid-cleanup-path")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}/invalid-frame")
file(MAKE_DIRECTORY "${TEST_WORK_DIR}/invalid-borrow")

set(MANIFEST_CONTENT [=[
{
  "schemaVersion": 1,
  "name": "analyzer-self-test",
  "profile": "runtime-strict",
  "allowLive": [],
  "expectations": [
    {"kind": "count", "eventKind": "memory.allocate", "equals": 2},
    {"kind": "count", "eventKind": "memory.free", "equals": 2},
    {
      "kind": "decision",
      "decisionKind": "Move",
      "decisionReason": "ReturnTransfersToCaller",
      "plannedAtLeast": 1,
      "loweredAtLeast": 1,
      "runtimeAtLeast": 1
    },
    {
      "kind": "cleanup",
      "owner": "value",
      "cleanupKind": "string",
      "destroyFunction": "yogi_string_destroy",
      "scheduledAtLeast": 1,
      "emittedAtLeast": 1,
      "runtimeAtLeast": 1
    }
  ],
  "ir": [
    {
      "kind": "call",
      "file": "valid.ll",
      "function": "cleanup",
      "callee": "destroy",
      "exactly": 1,
      "metadata": ["yogi.cleanup"]
    },
    {
      "kind": "namedMetadata",
      "file": "valid.ll",
      "name": "yogi.cleanup.obligations",
      "atLeast": 1
    }
  ]
}
]=])

file(WRITE "${TEST_WORK_DIR}/valid/manifest.json" "${MANIFEST_CONTENT}")
file(WRITE "${TEST_WORK_DIR}/invalid/manifest.json" "${MANIFEST_CONTENT}")
file(WRITE "${TEST_WORK_DIR}/invalid-decision/manifest.json" "${MANIFEST_CONTENT}")
file(WRITE "${TEST_WORK_DIR}/invalid-cleanup/manifest.json" "${MANIFEST_CONTENT}")
file(WRITE "${TEST_WORK_DIR}/invalid-lost-cleanup/manifest.json" "${MANIFEST_CONTENT}")
file(WRITE "${TEST_WORK_DIR}/invalid-duplicate-cleanup/manifest.json" "${MANIFEST_CONTENT}")
file(WRITE "${TEST_WORK_DIR}/invalid-cleanup-path/manifest.json" "${MANIFEST_CONTENT}")
file(WRITE "${TEST_WORK_DIR}/invalid-frame/manifest.json" "${MANIFEST_CONTENT}")
file(WRITE "${TEST_WORK_DIR}/invalid-borrow/manifest.json" "${MANIFEST_CONTENT}")
string(REPLACE "\"callee\": \"destroy\"" "\"callee\": \"missingDestroy\"" INVALID_IR_MANIFEST "${MANIFEST_CONTENT}")
file(WRITE "${TEST_WORK_DIR}/invalid-ir/manifest.json" "${INVALID_IR_MANIFEST}")

set(VALID_IR [=[
declare void @destroy()

define void @cleanup() {
entry:
  call void @destroy(), !yogi.cleanup !1
  ret void
}

!yogi.cleanup.obligations = !{!0}
!0 = !{!"cleanup:test:1", !"value", !"string", !"yogi_string_destroy", !"heap"}
!1 = !{!"cleanup:test:1"}
]=])

foreach(directory IN ITEMS
	valid
	invalid
	invalid-decision
	invalid-cleanup
	invalid-ir
	invalid-lost-cleanup
	invalid-duplicate-cleanup
	invalid-cleanup-path
	invalid-frame
	invalid-borrow
)
	file(WRITE "${TEST_WORK_DIR}/${directory}/valid.ll" "${VALID_IR}")
endforeach()

set(VALID_TRACE [=[
{"schemaVersion":1,"sessionId":"self","eventId":"event:d1","sequence":1,"phase":"frontend","category":"semantic","eventKind":"semantic.decision.plan","producer":"frontend:1","entityId":"decision:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"decisionId":"decision:test:1","nodeId":"node:test:1","valueId":"value:test:1","typeId":"type:test","decisionKind":"Move","decisionReason":"ReturnTransfersToCaller","relatedIds":["value:test:source"],"runtimeRequired":true}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:d2","sequence":1,"phase":"sir","category":"semantic","eventKind":"sir.decision.read","producer":"backend:1","entityId":"decision:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"decisionId":"decision:test:1","nodeId":"node:test:1","valueId":"value:test:1","typeId":"type:test","decisionKind":"Move","decisionReason":"ReturnTransfersToCaller","runtimeRequired":true}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:d3","sequence":2,"phase":"lowering","category":"semantic","eventKind":"lowering.decision.consume","producer":"backend:1","entityId":"decision:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"decisionId":"decision:test:1","nodeId":"node:test:1","valueId":"value:test:1","typeId":"type:test","decisionKind":"Move","decisionReason":"ReturnTransfersToCaller","runtimeRequired":true}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:f1","sequence":1,"phase":"runtime","category":"function","eventKind":"function.frame.enter","producer":"program:1","entityId":"frame:1:1","source":{"path":"test.ts","line":1,"column":1},"details":{"frameId":1,"parentFrameId":0}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:d4","sequence":2,"phase":"runtime","category":"semantic","eventKind":"semantic.decision.execute","producer":"program:1","entityId":"decision:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"decisionId":"decision:test:1","nodeId":"node:test:1","valueId":"value:test:1","typeId":"type:test","decisionKind":"Move","decisionReason":"ReturnTransfersToCaller","runtimeRequired":true,"frameId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:f2","sequence":3,"phase":"runtime","category":"function","eventKind":"function.frame.exit","producer":"program:1","entityId":"frame:1:1","source":{"path":"test.ts","line":1,"column":1},"details":{"frameId":1,"exitReason":"normal"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:1","sequence":1,"phase":"runtime","category":"memory","eventKind":"memory.allocate","producer":"runtime:1","entityId":"allocation:1:1","source":{"path":"test.ts","line":1,"column":1},"details":{"generation":1,"size":8,"address":"0x1000","typeName":"test"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:2","sequence":2,"phase":"runtime","category":"memory","eventKind":"memory.free","producer":"runtime:1","entityId":"allocation:1:1","source":{"path":"test.ts","line":2,"column":1},"details":{"generation":1,"size":8,"address":"0x1000","typeName":"test"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:3","sequence":3,"phase":"runtime","category":"memory","eventKind":"memory.allocate","producer":"runtime:1","entityId":"allocation:1:2","source":{"path":"test.ts","line":3,"column":1},"details":{"generation":1,"size":8,"address":"0x1000","typeName":"test"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:4","sequence":4,"phase":"runtime","category":"memory","eventKind":"memory.free","producer":"runtime:1","entityId":"allocation:1:2","source":{"path":"test.ts","line":4,"column":1},"details":{"generation":1,"size":8,"address":"0x1000","typeName":"test"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:5","sequence":5,"phase":"runtime","category":"session","eventKind":"process.summary","producer":"runtime:1","source":{"path":"<unknown>","line":0,"column":0},"details":{"liveAllocations":0,"liveAggregates":0,"liveResources":0,"droppedEvents":false}}
]=])

set(INVALID_TRACE [=[
{"schemaVersion":1,"sessionId":"self","eventId":"event:d1","sequence":1,"phase":"frontend","category":"semantic","eventKind":"semantic.decision.plan","producer":"frontend:1","entityId":"decision:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"decisionId":"decision:test:1","nodeId":"node:test:1","valueId":"value:test:1","typeId":"type:test","decisionKind":"Move","decisionReason":"ReturnTransfersToCaller","relatedIds":["value:test:source"],"runtimeRequired":true}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:d2","sequence":1,"phase":"sir","category":"semantic","eventKind":"sir.decision.read","producer":"backend:1","entityId":"decision:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"decisionId":"decision:test:1","nodeId":"node:test:1","valueId":"value:test:1","typeId":"type:test","decisionKind":"Move","decisionReason":"ReturnTransfersToCaller","runtimeRequired":true}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:d3","sequence":2,"phase":"lowering","category":"semantic","eventKind":"lowering.decision.consume","producer":"backend:1","entityId":"decision:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"decisionId":"decision:test:1","nodeId":"node:test:1","valueId":"value:test:1","typeId":"type:test","decisionKind":"Move","decisionReason":"ReturnTransfersToCaller","runtimeRequired":true}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:f1","sequence":1,"phase":"runtime","category":"function","eventKind":"function.frame.enter","producer":"program:1","entityId":"frame:1:1","source":{"path":"test.ts","line":1,"column":1},"details":{"frameId":1,"parentFrameId":0}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:d4","sequence":2,"phase":"runtime","category":"semantic","eventKind":"semantic.decision.execute","producer":"program:1","entityId":"decision:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"decisionId":"decision:test:1","nodeId":"node:test:1","valueId":"value:test:1","typeId":"type:test","decisionKind":"Move","decisionReason":"ReturnTransfersToCaller","runtimeRequired":true,"frameId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:f2","sequence":3,"phase":"runtime","category":"function","eventKind":"function.frame.exit","producer":"program:1","entityId":"frame:1:1","source":{"path":"test.ts","line":1,"column":1},"details":{"frameId":1,"exitReason":"normal"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:1","sequence":1,"phase":"runtime","category":"memory","eventKind":"memory.allocate","producer":"runtime:1","entityId":"allocation:1:1","source":{"path":"test.ts","line":1,"column":1},"details":{"generation":1,"size":8,"address":"0x1000","typeName":"test"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:2","sequence":2,"phase":"runtime","category":"memory","eventKind":"memory.free","producer":"runtime:1","entityId":"allocation:1:1","source":{"path":"test.ts","line":2,"column":1},"details":{"generation":1,"size":8,"address":"0x1000","typeName":"test"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:3","sequence":3,"phase":"runtime","category":"memory","eventKind":"memory.allocate","producer":"runtime:1","entityId":"allocation:1:1","source":{"path":"test.ts","line":3,"column":1},"details":{"generation":1,"size":8,"address":"0x1000","typeName":"test"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:4","sequence":4,"phase":"runtime","category":"memory","eventKind":"memory.free","producer":"runtime:1","entityId":"allocation:1:1","source":{"path":"test.ts","line":4,"column":1},"details":{"generation":1,"size":8,"address":"0x1000","typeName":"test"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:5","sequence":5,"phase":"runtime","category":"session","eventKind":"process.summary","producer":"runtime:1","source":{"path":"<unknown>","line":0,"column":0},"details":{"liveAllocations":0,"liveAggregates":0,"liveResources":0,"droppedEvents":false}}
]=])

set(INVALID_DECISION_TRACE [=[
{"schemaVersion":1,"sessionId":"self","eventId":"event:d1","sequence":1,"phase":"frontend","category":"semantic","eventKind":"semantic.decision.plan","producer":"frontend:1","entityId":"decision:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"decisionId":"decision:test:1","nodeId":"node:test:1","valueId":"value:test:1","typeId":"type:test","decisionKind":"Move","decisionReason":"ReturnTransfersToCaller","relatedIds":["value:test:source"],"runtimeRequired":true}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:d2","sequence":1,"phase":"sir","category":"semantic","eventKind":"sir.decision.read","producer":"backend:1","entityId":"decision:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"decisionId":"decision:test:1","nodeId":"node:test:1","valueId":"value:test:1","typeId":"type:test","decisionKind":"Move","decisionReason":"ReturnTransfersToCaller","runtimeRequired":true}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:f1","sequence":1,"phase":"runtime","category":"function","eventKind":"function.frame.enter","producer":"program:1","entityId":"frame:1:1","source":{"path":"test.ts","line":1,"column":1},"details":{"frameId":1,"parentFrameId":0}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:d4","sequence":2,"phase":"runtime","category":"semantic","eventKind":"semantic.decision.execute","producer":"program:1","entityId":"decision:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"decisionId":"decision:test:1","nodeId":"node:test:1","valueId":"value:test:1","typeId":"type:test","decisionKind":"Move","decisionReason":"ReturnTransfersToCaller","runtimeRequired":true,"frameId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:f2","sequence":3,"phase":"runtime","category":"function","eventKind":"function.frame.exit","producer":"program:1","entityId":"frame:1:1","source":{"path":"test.ts","line":1,"column":1},"details":{"frameId":1,"exitReason":"normal"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:1","sequence":1,"phase":"runtime","category":"memory","eventKind":"memory.allocate","producer":"runtime:1","entityId":"allocation:1:1","source":{"path":"test.ts","line":1,"column":1},"details":{"generation":1,"size":8,"address":"0x1000","typeName":"test"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:2","sequence":2,"phase":"runtime","category":"memory","eventKind":"memory.free","producer":"runtime:1","entityId":"allocation:1:1","source":{"path":"test.ts","line":2,"column":1},"details":{"generation":1,"size":8,"address":"0x1000","typeName":"test"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:3","sequence":3,"phase":"runtime","category":"memory","eventKind":"memory.allocate","producer":"runtime:1","entityId":"allocation:1:2","source":{"path":"test.ts","line":3,"column":1},"details":{"generation":1,"size":8,"address":"0x1000","typeName":"test"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:4","sequence":4,"phase":"runtime","category":"memory","eventKind":"memory.free","producer":"runtime:1","entityId":"allocation:1:2","source":{"path":"test.ts","line":4,"column":1},"details":{"generation":1,"size":8,"address":"0x1000","typeName":"test"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:5","sequence":5,"phase":"runtime","category":"session","eventKind":"process.summary","producer":"runtime:1","source":{"path":"<unknown>","line":0,"column":0},"details":{"liveAllocations":0,"liveAggregates":0,"liveResources":0,"droppedEvents":false}}
]=])

set(VALID_CLEANUP_TRACE [=[
{"schemaVersion":1,"sessionId":"self","eventId":"event:c1","sequence":1,"phase":"lowering","category":"cleanup","eventKind":"cleanup.schedule","producer":"cleanup-backend:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","exitReason":"none","symbolId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:c2","sequence":2,"phase":"lowering","category":"cleanup","eventKind":"cleanup.emit","producer":"cleanup-backend:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","exitReason":"normal","symbolId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:cf1","sequence":1,"phase":"runtime","category":"function","eventKind":"function.frame.enter","producer":"cleanup-runtime:1","entityId":"frame:cleanup:1","source":{"path":"test.ts","line":1,"column":1},"details":{"frameId":1,"parentFrameId":0}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:c3","sequence":2,"phase":"runtime","category":"cleanup","eventKind":"cleanup.activate","producer":"cleanup-runtime:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","exitReason":"none","symbolId":-1,"frameId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:c4","sequence":3,"phase":"runtime","category":"cleanup","eventKind":"cleanup.execute","producer":"cleanup-runtime:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","exitReason":"normal","symbolId":-1,"frameId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:cf2","sequence":4,"phase":"runtime","category":"function","eventKind":"function.frame.exit","producer":"cleanup-runtime:1","entityId":"frame:cleanup:1","source":{"path":"test.ts","line":1,"column":1},"details":{"frameId":1,"exitReason":"normal"}}
]=])

set(MISSING_CLEANUP_TRACE [=[
{"schemaVersion":1,"sessionId":"self","eventId":"event:c1","sequence":1,"phase":"lowering","category":"cleanup","eventKind":"cleanup.schedule","producer":"cleanup-backend:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","symbolId":1}}
]=])

set(LOST_CLEANUP_TRACE [=[
{"schemaVersion":1,"sessionId":"self","eventId":"event:lc1","sequence":1,"phase":"lowering","category":"cleanup","eventKind":"cleanup.schedule","producer":"lost-backend:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","exitReason":"none","symbolId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:lc2","sequence":2,"phase":"lowering","category":"cleanup","eventKind":"cleanup.emit","producer":"lost-backend:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","exitReason":"normal","symbolId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:lf1","sequence":1,"phase":"runtime","category":"function","eventKind":"function.frame.enter","producer":"lost-runtime:1","entityId":"frame:lost:1","source":{"path":"test.ts","line":1,"column":1},"details":{"frameId":1,"parentFrameId":0}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:lc3","sequence":2,"phase":"runtime","category":"cleanup","eventKind":"cleanup.activate","producer":"lost-runtime:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","exitReason":"none","symbolId":-1,"frameId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:lf2","sequence":3,"phase":"runtime","category":"function","eventKind":"function.frame.exit","producer":"lost-runtime:1","entityId":"frame:lost:1","source":{"path":"test.ts","line":2,"column":1},"details":{"frameId":1,"exitReason":"normal"}}
]=])

set(DUPLICATE_CLEANUP_TRACE [=[
{"schemaVersion":1,"sessionId":"self","eventId":"event:dc1","sequence":1,"phase":"lowering","category":"cleanup","eventKind":"cleanup.schedule","producer":"duplicate-backend:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","exitReason":"none","symbolId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:dc2","sequence":2,"phase":"lowering","category":"cleanup","eventKind":"cleanup.emit","producer":"duplicate-backend:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","exitReason":"normal","symbolId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:df1","sequence":1,"phase":"runtime","category":"function","eventKind":"function.frame.enter","producer":"duplicate-runtime:1","entityId":"frame:duplicate:1","source":{"path":"test.ts","line":1,"column":1},"details":{"frameId":1,"parentFrameId":0}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:dc3","sequence":2,"phase":"runtime","category":"cleanup","eventKind":"cleanup.activate","producer":"duplicate-runtime:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":1,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","exitReason":"none","symbolId":-1,"frameId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:dc4","sequence":3,"phase":"runtime","category":"cleanup","eventKind":"cleanup.execute","producer":"duplicate-runtime:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":2,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","exitReason":"normal","symbolId":-1,"frameId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:dc5","sequence":4,"phase":"runtime","category":"cleanup","eventKind":"cleanup.execute","producer":"duplicate-runtime:1","entityId":"cleanup:test:1","source":{"path":"test.ts","line":3,"column":1},"details":{"cleanupId":"cleanup:test:1","owner":"value","cleanupKind":"string","destroyFunction":"yogi_string_destroy","storage":"heap","exitReason":"normal","symbolId":-1,"frameId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:df2","sequence":5,"phase":"runtime","category":"function","eventKind":"function.frame.exit","producer":"duplicate-runtime:1","entityId":"frame:duplicate:1","source":{"path":"test.ts","line":4,"column":1},"details":{"frameId":1,"exitReason":"normal"}}
]=])

string(REPLACE "\"exitReason\":\"normal\",\"symbolId\":-1,\"frameId\":1" "\"exitReason\":\"break\",\"symbolId\":-1,\"frameId\":1" WRONG_PATH_CLEANUP_TRACE "${VALID_CLEANUP_TRACE}")

set(INVALID_FRAME_TRACE [=[
{"schemaVersion":1,"sessionId":"self","eventId":"event:if1","sequence":1,"phase":"runtime","category":"function","eventKind":"function.frame.enter","producer":"frame-runtime:1","entityId":"frame:invalid:1","source":{"path":"test.ts","line":1,"column":1},"details":{"frameId":1,"parentFrameId":0}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:if2","sequence":2,"phase":"runtime","category":"function","eventKind":"function.frame.enter","producer":"frame-runtime:1","entityId":"frame:invalid:2","source":{"path":"test.ts","line":2,"column":1},"details":{"frameId":2,"parentFrameId":1}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:if3","sequence":3,"phase":"runtime","category":"function","eventKind":"function.frame.exit","producer":"frame-runtime:1","entityId":"frame:invalid:1","source":{"path":"test.ts","line":3,"column":1},"details":{"frameId":1,"exitReason":"normal"}}
{"schemaVersion":1,"sessionId":"self","eventId":"event:if4","sequence":4,"phase":"runtime","category":"function","eventKind":"function.frame.exit","producer":"frame-runtime:1","entityId":"frame:invalid:2","source":{"path":"test.ts","line":4,"column":1},"details":{"frameId":2,"exitReason":"normal"}}
]=])

string(REPLACE "\"decisionKind\":\"Move\"" "\"decisionKind\":\"Borrow\"" INVALID_BORROW_TRACE "${VALID_TRACE}")
string(REPLACE "\"decisionReason\":\"ReturnTransfersToCaller\"" "\"decisionReason\":\"AddressOfBorrow\"" INVALID_BORROW_TRACE "${INVALID_BORROW_TRACE}")
string(REPLACE "\"relatedIds\":[\"value:test:source\"]," "" INVALID_BORROW_TRACE "${INVALID_BORROW_TRACE}")

file(WRITE "${TEST_WORK_DIR}/valid/runtime-1.events.jsonl" "${VALID_TRACE}${VALID_CLEANUP_TRACE}")
file(WRITE "${TEST_WORK_DIR}/invalid/runtime-1.events.jsonl" "${INVALID_TRACE}${VALID_CLEANUP_TRACE}")
file(WRITE "${TEST_WORK_DIR}/invalid-decision/runtime-1.events.jsonl" "${INVALID_DECISION_TRACE}${VALID_CLEANUP_TRACE}")
file(WRITE "${TEST_WORK_DIR}/invalid-cleanup/runtime-1.events.jsonl" "${VALID_TRACE}${MISSING_CLEANUP_TRACE}")
file(WRITE "${TEST_WORK_DIR}/invalid-ir/runtime-1.events.jsonl" "${VALID_TRACE}${VALID_CLEANUP_TRACE}")
file(WRITE "${TEST_WORK_DIR}/invalid-lost-cleanup/runtime-1.events.jsonl" "${VALID_TRACE}${LOST_CLEANUP_TRACE}")
file(WRITE "${TEST_WORK_DIR}/invalid-duplicate-cleanup/runtime-1.events.jsonl" "${VALID_TRACE}${DUPLICATE_CLEANUP_TRACE}")
file(WRITE "${TEST_WORK_DIR}/invalid-cleanup-path/runtime-1.events.jsonl" "${VALID_TRACE}${WRONG_PATH_CLEANUP_TRACE}")
file(WRITE "${TEST_WORK_DIR}/invalid-frame/runtime-1.events.jsonl" "${VALID_TRACE}${VALID_CLEANUP_TRACE}${INVALID_FRAME_TRACE}")
file(WRITE "${TEST_WORK_DIR}/invalid-borrow/runtime-1.events.jsonl" "${INVALID_BORROW_TRACE}${VALID_CLEANUP_TRACE}")

execute_process(
	COMMAND "${YOGI_PROGRAM_TRACE_ANALYZER}"
		--trace-dir "${TEST_WORK_DIR}/valid"
		--manifest "${TEST_WORK_DIR}/valid/manifest.json"
		--test analyzer-valid
		--observability-enabled 1
		--artifact-root "${TEST_WORK_DIR}/valid"
	RESULT_VARIABLE valid_result
	ERROR_VARIABLE valid_stderr
)

if(NOT valid_result EQUAL 0)
	message(FATAL_ERROR "valid analyzer fixture failed:\n${valid_stderr}")
endif()

execute_process(
	COMMAND "${YOGI_PROGRAM_TRACE_ANALYZER}"
		--trace-dir "${TEST_WORK_DIR}/invalid"
		--manifest "${TEST_WORK_DIR}/invalid/manifest.json"
		--test analyzer-invalid
		--observability-enabled 1
		--artifact-root "${TEST_WORK_DIR}/invalid"
	RESULT_VARIABLE invalid_result
	ERROR_VARIABLE invalid_stderr
)

if(invalid_result EQUAL 0)
	message(FATAL_ERROR "invalid analyzer fixture unexpectedly passed")
endif()

file(READ "${TEST_WORK_DIR}/invalid/anomalies.json" invalid_anomalies)
if(NOT invalid_anomalies MATCHES "memory.identity_reuse")
	message(FATAL_ERROR "invalid analyzer fixture did not reject allocation identity reuse")
endif()

execute_process(
	COMMAND "${YOGI_PROGRAM_TRACE_ANALYZER}"
		--trace-dir "${TEST_WORK_DIR}/invalid-decision"
		--manifest "${TEST_WORK_DIR}/invalid-decision/manifest.json"
		--test analyzer-invalid-decision
		--observability-enabled 1
		--artifact-root "${TEST_WORK_DIR}/invalid-decision"
	RESULT_VARIABLE invalid_decision_result
	ERROR_VARIABLE invalid_decision_stderr
)

if(invalid_decision_result EQUAL 0)
	message(FATAL_ERROR "invalid semantic decision fixture unexpectedly passed")
endif()

file(READ "${TEST_WORK_DIR}/invalid-decision/anomalies.json" invalid_decision_anomalies)
if(NOT invalid_decision_anomalies MATCHES "decision.missing_lowering")
	message(FATAL_ERROR "invalid semantic decision fixture did not reject a missing lowering decision")
endif()

execute_process(
	COMMAND "${YOGI_PROGRAM_TRACE_ANALYZER}"
		--trace-dir "${TEST_WORK_DIR}/invalid-cleanup"
		--manifest "${TEST_WORK_DIR}/invalid-cleanup/manifest.json"
		--test analyzer-invalid-cleanup
		--observability-enabled 1
		--artifact-root "${TEST_WORK_DIR}/invalid-cleanup"
	RESULT_VARIABLE invalid_cleanup_result
	ERROR_VARIABLE invalid_cleanup_stderr
)

if(invalid_cleanup_result EQUAL 0)
	message(FATAL_ERROR "invalid cleanup fixture unexpectedly passed")
endif()

file(READ "${TEST_WORK_DIR}/invalid-cleanup/anomalies.json" invalid_cleanup_anomalies)
if(NOT invalid_cleanup_anomalies MATCHES "cleanup.missing_emission")
	message(FATAL_ERROR "invalid cleanup fixture did not reject a missing cleanup emission")
endif()

execute_process(
	COMMAND "${YOGI_PROGRAM_TRACE_ANALYZER}"
		--trace-dir "${TEST_WORK_DIR}/invalid-ir"
		--manifest "${TEST_WORK_DIR}/invalid-ir/manifest.json"
		--test analyzer-invalid-ir
		--observability-enabled 1
		--artifact-root "${TEST_WORK_DIR}/invalid-ir"
	RESULT_VARIABLE invalid_ir_result
	ERROR_VARIABLE invalid_ir_stderr
)

if(invalid_ir_result EQUAL 0)
	message(FATAL_ERROR "invalid LLVM fixture unexpectedly passed")
endif()

file(READ "${TEST_WORK_DIR}/invalid-ir/anomalies.json" invalid_ir_anomalies)
if(NOT invalid_ir_anomalies MATCHES "ir.expectation_count")
	message(FATAL_ERROR "invalid LLVM fixture did not reject a missing structural call")
endif()

function(expect_analyzer_failure DIRECTORY EXPECTED_CODE)
	execute_process(
		COMMAND "${YOGI_PROGRAM_TRACE_ANALYZER}"
			--trace-dir "${TEST_WORK_DIR}/${DIRECTORY}"
			--manifest "${TEST_WORK_DIR}/${DIRECTORY}/manifest.json"
			--test "analyzer-${DIRECTORY}"
			--observability-enabled 1
			--artifact-root "${TEST_WORK_DIR}/${DIRECTORY}"
		RESULT_VARIABLE analyzer_result
		ERROR_VARIABLE analyzer_stderr
	)

	if(analyzer_result EQUAL 0)
		message(FATAL_ERROR "${DIRECTORY} analyzer fixture unexpectedly passed")
	endif()

	file(READ "${TEST_WORK_DIR}/${DIRECTORY}/anomalies.json" analyzer_anomalies)
	if(NOT analyzer_anomalies MATCHES "${EXPECTED_CODE}")
		message(FATAL_ERROR
			"${DIRECTORY} analyzer fixture did not report ${EXPECTED_CODE}:\n"
			"${analyzer_stderr}\n${analyzer_anomalies}"
		)
	endif()
endfunction()

expect_analyzer_failure("invalid-lost-cleanup" "cleanup.lost_obligation")
expect_analyzer_failure("invalid-duplicate-cleanup" "cleanup.duplicate_execution")
expect_analyzer_failure("invalid-cleanup-path" "cleanup.wrong_exit_path")
expect_analyzer_failure("invalid-frame" "frame.non_lifo_exit")
expect_analyzer_failure("invalid-borrow" "borrow.missing_source")
