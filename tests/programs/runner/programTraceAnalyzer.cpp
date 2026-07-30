// Created by Brayhan De Aza on 7/26/26.
//

#include "llvm/programIrInspector.h"

#include <llvm/Support/JSON.h>
#include <llvm/Support/MemoryBuffer.h>

#include <algorithm>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <set>
#include <sstream>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace {

    struct EntityState {
        std::string category;
        std::string typeName;
        std::string lastEventId;
        std::int64_t generation = 0;
        bool alive = false;
    };

    struct Anomaly {
        std::string code;
        std::string message;
        std::string eventId;
        std::string source;
    };

    struct CountExpectation {
        std::string eventKind;
        std::int64_t equals = 0;
    };

    struct DecisionExpectation {
        std::string decisionKind;
        std::string decisionReason;
        std::int64_t plannedAtLeast = 0;
        std::int64_t loweredAtLeast = 0;
        std::int64_t runtimeAtLeast = 0;
    };

    struct DecisionState {
        std::string kind;
        std::string reason;
        std::string valueId;
        std::vector<std::string> relatedIds;
        std::string planEventId;
        std::string sirEventId;
        std::string loweringEventId;
        std::string source;
        std::size_t runtimeExecutions = 0;
        bool runtimeRequired = false;
    };

    struct CleanupExpectation {
        std::string owner;
        std::string cleanupKind;
        std::string destroyFunction;
        std::int64_t scheduledAtLeast = 0;
        std::int64_t emittedAtLeast = 0;
        std::int64_t cancelledAtLeast = 0;
        std::int64_t runtimeAtLeast = 0;
        std::map<std::string, std::int64_t> runtimeByExit;
    };

    struct CleanupState {
        std::string owner;
        std::string cleanupKind;
        std::string destroyFunction;
        std::string storage;
        std::string scheduleEventId;
        std::string source;
        std::size_t rearms = 0;
        std::size_t cancellations = 0;
        std::size_t emissions = 0;
        std::size_t runtimeExecutions = 0;
        std::set<std::string> emissionExitReasons;
        std::map<std::string, std::size_t> runtimeByExit;
    };

    struct FrameState {
        std::string producer;
        std::string entityId;
        std::string entryEventId;
        std::string exitEventId;
        std::string exitReason;
        std::string source;
        std::uint64_t frameId = 0;
        std::uint64_t parentFrameId = 0;
        bool active = false;
    };

    struct RuntimeCleanupState {
        std::string producer;
        std::string cleanupId;
        std::string owner;
        std::string lastEventId;
        std::string source;
        std::string terminalKind;
        std::uint64_t frameId = 0;
        std::size_t generation = 0;
        bool active = false;
        bool lostReported = false;
    };

    struct DecisionExecution {
        std::string producer;
        std::string decisionId;
        std::string eventId;
        std::string source;
        std::uint64_t sequence = 0;
        std::uint64_t frameId = 0;
    };

    struct Manifest {
        std::string profile = "runtime-strict";
        std::set<std::pair<std::string, std::string>> allowedLiveEntities;
        std::vector<CountExpectation> countExpectations;
        std::vector<DecisionExpectation> decisionExpectations;
        std::vector<CleanupExpectation> cleanupExpectations;
        std::vector<yogi::testing::IrExpectation> irExpectations;
    };

    struct AnalyzerState {
        std::unordered_map<std::string, std::uint64_t> producerSequences;
        std::unordered_map<std::string, EntityState> entities;
        std::unordered_map<std::string, std::size_t> eventKindCounts;
        std::unordered_map<std::string, DecisionState> decisions;
        std::unordered_map<std::string, CleanupState> cleanups;
        std::unordered_map<std::string, FrameState> frames;
        std::unordered_map<std::string, std::vector<std::string>> frameStacks;
        std::unordered_map<std::string, RuntimeCleanupState> runtimeCleanups;
        std::vector<DecisionExecution> decisionExecutions;
        std::set<std::string> eventIds;
        std::vector<Anomaly> anomalies;
        std::vector<std::string> timeline;
        std::size_t eventCount = 0;
        std::size_t processSummaries = 0;
        std::size_t allowedLiveEntities = 0;
        std::size_t llvmModules = 0;
        std::size_t ownerTransitions = 0;
        std::size_t borrowObservations = 0;
        std::size_t completedFrames = 0;
        std::size_t dynamicCleanupGenerations = 0;
    };

    void writeJsonString(std::ostream& stream, const std::string& value) {
        stream << '"';
        for (const auto character : value) {
            switch (character) {
                case '"':
                    stream << "\\\"";
                    break;
                case '\\':
                    stream << "\\\\";
                    break;
                case '\n':
                    stream << "\\n";
                    break;
                case '\r':
                    stream << "\\r";
                    break;
                case '\t':
                    stream << "\\t";
                    break;
                default:
                    stream << character;
                    break;
            }
        }
        stream << '"';
    }

    std::string stringValue(const llvm::json::Object& object, llvm::StringRef key) {
        const auto value = object.getString(key);
        return value ? value->str() : std::string();
    }

    std::int64_t integerValue(const llvm::json::Object& object, llvm::StringRef key, std::int64_t fallback = 0) {
        const auto value = object.getInteger(key);
        return value ? *value : fallback;
    }

    std::string sourceText(const llvm::json::Object& event) {
        const auto* source = event.getObject("source");
        if (!source) {
            return "<unknown>:0:0";
        }

        std::ostringstream stream;
        stream << stringValue(*source, "path") << ':' << integerValue(*source, "line") << ':' << integerValue(*source, "column");
        return stream.str();
    }

    void addAnomaly(AnalyzerState& state, std::string code, std::string message, std::string eventId = {}, std::string source = {}) {
        state.anomalies.push_back({
            std::move(code),
            std::move(message),
            std::move(eventId),
            std::move(source),
        });
    }

    Manifest readManifest(const std::filesystem::path& path, AnalyzerState& state) {
        Manifest manifest;
        auto buffer = llvm::MemoryBuffer::getFile(path.string());
        if (!buffer) {
            addAnomaly(state, "manifest.read", "cannot read manifest: " + path.string());
            return manifest;
        }

        auto parsed = llvm::json::parse(buffer.get()->getBuffer());
        if (!parsed) {
            addAnomaly(state, "manifest.parse", "manifest is not valid JSON: " + path.string());
            return manifest;
        }

        const auto* root = parsed->getAsObject();
        if (!root) {
            addAnomaly(state, "manifest.shape", "manifest root must be an object");
            return manifest;
        }

        if (const auto profile = root->getString("profile")) {
            manifest.profile = profile->str();
        }

        if (const auto* allowLive = root->getArray("allowLive")) {
            for (const auto& entry : *allowLive) {
                const auto* object = entry.getAsObject();
                if (!object) {
                    continue;
                }

                if (const auto typeName = object->getString("typeName")) {
                    const auto category = object->getString("category");
                    manifest.allowedLiveEntities.insert({
                        category ? category->str() : std::string("memory"),
                        typeName->str(),
                    });
                }
            }
        }

        if (const auto* expectations = root->getArray("expectations")) {
            for (const auto& entry : *expectations) {
                const auto* object = entry.getAsObject();
                if (!object) {
                    continue;
                }

                const auto kind = object->getString("kind");
                if (!kind) {
                    continue;
                }

                if (*kind == "count") {
                    const auto eventKind = object->getString("eventKind");
                    const auto equals = object->getInteger("equals");
                    if (eventKind && equals) {
                        manifest.countExpectations.push_back({eventKind->str(), *equals});
                    }
                    continue;
                }

                if (*kind == "decision") {
                    DecisionExpectation expectation;
                    expectation.decisionKind = object->getString("decisionKind").value_or("").str();
                    expectation.decisionReason = object->getString("decisionReason").value_or("").str();
                    expectation.plannedAtLeast = object->getInteger("plannedAtLeast").value_or(0);
                    expectation.loweredAtLeast = object->getInteger("loweredAtLeast").value_or(0);
                    expectation.runtimeAtLeast = object->getInteger("runtimeAtLeast").value_or(0);
                    manifest.decisionExpectations.push_back(std::move(expectation));
                    continue;
                }

                if (*kind == "cleanup") {
                    CleanupExpectation expectation;
                    expectation.owner = object->getString("owner").value_or("").str();
                    expectation.cleanupKind = object->getString("cleanupKind").value_or("").str();
                    expectation.destroyFunction = object->getString("destroyFunction").value_or("").str();
                    expectation.scheduledAtLeast = object->getInteger("scheduledAtLeast").value_or(0);
                    expectation.emittedAtLeast = object->getInteger("emittedAtLeast").value_or(0);
                    expectation.cancelledAtLeast = object->getInteger("cancelledAtLeast").value_or(0);
                    expectation.runtimeAtLeast = object->getInteger("runtimeAtLeast").value_or(0);
                    if (const auto* runtimeByExit = object->getObject("runtimeByExit")) {
                        for (const auto& [exitReason, count] : *runtimeByExit) {
                            if (const auto expected = count.getAsInteger()) {
                                expectation.runtimeByExit[exitReason.str()] = *expected;
                            }
                        }
                    }
                    manifest.cleanupExpectations.push_back(std::move(expectation));
                }
            }
        }

        if (const auto* expectations = root->getArray("ir")) {
            for (const auto& entry : *expectations) {
                const auto* object = entry.getAsObject();
                if (!object) {
                    continue;
                }

                yogi::testing::IrExpectation expectation;
                expectation.kind = object->getString("kind").value_or("").str();
                expectation.file = object->getString("file").value_or("").str();
                expectation.name = object->getString("name").value_or("").str();
                expectation.function = object->getString("function").value_or("").str();
                expectation.callee = object->getString("callee").value_or("").str();
                expectation.exactly = object->getInteger("exactly").value_or(-1);
                expectation.atLeast = object->getInteger("atLeast").value_or(1);

                if (const auto* metadata = object->getArray("metadata")) {
                    for (const auto& name : *metadata) {
                        if (const auto value = name.getAsString()) {
                            expectation.metadata.push_back(value->str());
                        }
                    }
                }

                if (expectation.kind.empty() || expectation.file.empty()) {
                    addAnomaly(state, "manifest.ir", "LLVM expectation requires kind and file");
                    continue;
                }
                manifest.irExpectations.push_back(std::move(expectation));
            }
        }

        return manifest;
    }

    bool validateEnvelope(const llvm::json::Object& event, const std::filesystem::path& path, std::size_t lineNumber, AnalyzerState& state) {
        const auto version = event.getInteger("schemaVersion");
        const auto sequence = event.getInteger("sequence");
        const auto sessionId = event.getString("sessionId");
        const auto eventId = event.getString("eventId");
        const auto phase = event.getString("phase");
        const auto category = event.getString("category");
        const auto eventKind = event.getString("eventKind");
        const auto producer = event.getString("producer");

        if (!version || *version != 1 || !sequence || !sessionId || !eventId || !phase || !category || !eventKind || !producer) {
            addAnomaly(state, "event.envelope", "missing or invalid required event field", {}, path.string() + ':' + std::to_string(lineNumber));
            return false;
        }

        if (!state.eventIds.insert(eventId->str()).second) {
            addAnomaly(state, "event.duplicate_id", "duplicate eventId " + eventId->str(), eventId->str(), sourceText(event));
        }

        auto& lastSequence = state.producerSequences[producer->str()];
        if (static_cast<std::uint64_t>(*sequence) <= lastSequence) {
            addAnomaly(state, "event.sequence", "event sequence is not monotonic for producer " + producer->str(), eventId->str(), sourceText(event));
        }
        lastSequence = static_cast<std::uint64_t>(*sequence);
        return true;
    }

    void transitionCreate(const std::string& entityId, const std::string& category, const std::string& typeName, const std::string& eventId, const std::string& source, std::int64_t generation, AnalyzerState& state) {
        const auto existing = state.entities.find(entityId);
        if (existing != state.entities.end()) {
            addAnomaly(
                state,
                existing->second.alive ? category + ".duplicate_create" : category + ".identity_reuse",
                existing->second.alive ? category + " entity was created while already alive: " + entityId : category + " entity identity was reused after its lifetime ended: " + entityId,
                eventId,
                source);
        }

        auto& entity = state.entities[entityId];
        entity.category = category;
        entity.typeName = typeName;
        entity.lastEventId = eventId;
        entity.generation = generation;
        entity.alive = true;
    }

    void transitionDestroy(const std::string& entityId, const std::string& category, const std::string& eventId, const std::string& source, AnalyzerState& state) {
        const auto iterator = state.entities.find(entityId);
        if (iterator == state.entities.end() || !iterator->second.alive) {
            addAnomaly(state, category + ".invalid_destroy", category + " entity was destroyed without a live create: " + entityId, eventId, source);
            return;
        }

        iterator->second.alive = false;
        iterator->second.lastEventId = eventId;
    }

    std::vector<std::string> stringArrayValue(const llvm::json::Object& object, llvm::StringRef key) {
        std::vector<std::string> values;
        const auto* array = object.getArray(key);
        if (!array) {
            return values;
        }

        for (const auto& entry : *array) {
            if (const auto value = entry.getAsString()) {
                values.push_back(value->str());
            }
        }
        return values;
    }

    std::string frameKey(const std::string& producer, std::uint64_t frameId) {
        return producer + '#' + std::to_string(frameId);
    }

    bool eventMatchesCurrentFrame(const std::string& producer, std::uint64_t frameId, const std::string& eventId, const std::string& source, const std::string& anomalyPrefix, AnalyzerState& state) {
        if (frameId == 0) {
            addAnomaly(state, anomalyPrefix + ".missing_frame", "runtime event is not correlated with a frame", eventId, source);
            return false;
        }

        const auto stack = state.frameStacks.find(producer);
        if (stack == state.frameStacks.end() || stack->second.empty()) {
            addAnomaly(state, anomalyPrefix + ".outside_frame", "runtime event occurred without an active frame", eventId, source);
            return false;
        }

        const auto frame = state.frames.find(stack->second.back());
        if (frame == state.frames.end() || frame->second.frameId != frameId) {
            addAnomaly(state, anomalyPrefix + ".wrong_frame", "runtime event references frame " + std::to_string(frameId) + " while another frame is active", eventId, source);
            return false;
        }
        return true;
    }

    void
    recordDecisionEvent(const std::string& phase, const std::string& eventKind, const std::string& producer, std::uint64_t sequence, const std::string& eventId, const std::string& source, const llvm::json::Object* details, AnalyzerState& state) {
        if (!details) {
            addAnomaly(state, "decision.details", "semantic decision event is missing details", eventId, source);
            return;
        }

        const auto decisionId = stringValue(*details, "decisionId");
        const auto decisionKind = stringValue(*details, "decisionKind");
        const auto decisionReason = stringValue(*details, "decisionReason");
        if (decisionId.empty() || decisionKind.empty() || decisionReason.empty()) {
            addAnomaly(state, "decision.identity", "semantic decision event is missing stable identity or classification", eventId, source);
            return;
        }

        auto& decision = state.decisions[decisionId];
        if ((!decision.kind.empty() && decision.kind != decisionKind) || (!decision.reason.empty() && decision.reason != decisionReason)) {
            addAnomaly(state, "decision.classification_mismatch", "semantic decision changed classification across phases: " + decisionId, eventId, source);
        }

        decision.kind = decisionKind;
        decision.reason = decisionReason;
        const auto valueId = stringValue(*details, "valueId");
        if (!valueId.empty()) {
            decision.valueId = valueId;
        }
        decision.runtimeRequired = decision.runtimeRequired || details->getBoolean("runtimeRequired").value_or(false);
        if (decision.source.empty()) {
            decision.source = source;
        }

        if (eventKind == "semantic.decision.plan") {
            if (!decision.planEventId.empty()) {
                addAnomaly(state, "decision.duplicate_plan", "semantic decision was planned more than once: " + decisionId, eventId, source);
            }
            decision.planEventId = eventId;
            decision.relatedIds = stringArrayValue(*details, "relatedIds");
        } else if (eventKind == "sir.decision.read") {
            if (!decision.sirEventId.empty()) {
                addAnomaly(state, "decision.duplicate_sir_read", "semantic decision was read from SIR more than once: " + decisionId, eventId, source);
            }
            decision.sirEventId = eventId;
        } else if (eventKind == "lowering.decision.consume") {
            if (!decision.loweringEventId.empty()) {
                addAnomaly(state, "decision.duplicate_lowering", "semantic decision was consumed by lowering more than once: " + decisionId, eventId, source);
            }
            decision.loweringEventId = eventId;
        } else if (eventKind == "semantic.decision.execute") {
            ++decision.runtimeExecutions;
            const auto frameId = static_cast<std::uint64_t>(integerValue(*details, "frameId"));
            eventMatchesCurrentFrame(producer, frameId, eventId, source, "decision", state);
            state.decisionExecutions.push_back({
                producer,
                decisionId,
                eventId,
                source,
                sequence,
                frameId,
            });
        }
        (void)phase;
    }

    void recordCleanupEvent(const std::string& phase, const std::string& eventKind, const std::string& producer, const std::string& eventId, const std::string& source, const llvm::json::Object* details, AnalyzerState& state) {
        if (!details) {
            addAnomaly(state, "cleanup.details", "cleanup event is missing details", eventId, source);
            return;
        }

        const auto cleanupId = stringValue(*details, "cleanupId");
        const auto owner = stringValue(*details, "owner");
        const auto cleanupKind = stringValue(*details, "cleanupKind");
        const auto destroyFunction = stringValue(*details, "destroyFunction");
        const auto storage = stringValue(*details, "storage");
        const auto exitReason = stringValue(*details, "exitReason");
        if (cleanupId.empty() || owner.empty() || cleanupKind.empty() || destroyFunction.empty()) {
            addAnomaly(state, "cleanup.identity", "cleanup event is missing stable identity or policy", eventId, source);
            return;
        }

        auto& cleanup = state.cleanups[cleanupId];
        if ((!cleanup.owner.empty() && cleanup.owner != owner) || (!cleanup.cleanupKind.empty() && cleanup.cleanupKind != cleanupKind) || (!cleanup.destroyFunction.empty() && cleanup.destroyFunction != destroyFunction) ||
            (!cleanup.storage.empty() && cleanup.storage != storage)) {
            addAnomaly(state, "cleanup.policy_mismatch", "cleanup policy changed across phases: " + cleanupId, eventId, source);
        }

        cleanup.owner = owner;
        cleanup.cleanupKind = cleanupKind;
        cleanup.destroyFunction = destroyFunction;
        cleanup.storage = storage;
        if (cleanup.source.empty()) {
            cleanup.source = source;
        }

        if (eventKind == "cleanup.schedule" && phase != "runtime") {
            if (!cleanup.scheduleEventId.empty()) {
                addAnomaly(state, "cleanup.duplicate_schedule", "cleanup obligation was scheduled more than once: " + cleanupId, eventId, source);
            }
            cleanup.scheduleEventId = eventId;
        } else if (eventKind == "cleanup.rearm" && phase != "runtime") {
            ++cleanup.rearms;
        } else if (eventKind == "cleanup.cancel" && phase != "runtime") {
            ++cleanup.cancellations;
        } else if (eventKind == "cleanup.emit" && phase != "runtime") {
            ++cleanup.emissions;
            cleanup.emissionExitReasons.insert(exitReason.empty() ? "normal" : exitReason);
        } else if (eventKind == "cleanup.execute" && phase == "runtime") {
            ++cleanup.runtimeExecutions;
            ++cleanup.runtimeByExit[exitReason];
        }

        if (phase != "runtime") {
            return;
        }

        if (eventKind != "cleanup.activate" && eventKind != "cleanup.rearm" && eventKind != "cleanup.cancel" && eventKind != "cleanup.execute" && eventKind != "cleanup.skip") {
            addAnomaly(state, "cleanup.runtime_event", "unknown runtime cleanup transition: " + eventKind, eventId, source);
            return;
        }

        const auto frameId = static_cast<std::uint64_t>(integerValue(*details, "frameId"));
        eventMatchesCurrentFrame(producer, frameId, eventId, source, "cleanup", state);
        const auto dynamicKey = frameKey(producer, frameId) + '#' + cleanupId;
        auto& dynamic = state.runtimeCleanups[dynamicKey];
        if (!dynamic.cleanupId.empty() && dynamic.owner != owner) {
            addAnomaly(state, "owner.identity_mismatch", "dynamic cleanup owner changed for " + cleanupId, eventId, source);
        }
        dynamic.producer = producer;
        dynamic.cleanupId = cleanupId;
        dynamic.owner = owner;
        dynamic.frameId = frameId;
        dynamic.lastEventId = eventId;
        dynamic.source = source;

        if (eventKind == "cleanup.activate") {
            if (dynamic.active) {
                addAnomaly(state, "cleanup.duplicate_activation", "cleanup obligation was activated while its previous generation was still active: " + cleanupId, eventId, source);
            }
            dynamic.active = true;
            dynamic.lostReported = false;
            dynamic.terminalKind.clear();
            ++dynamic.generation;
            ++state.dynamicCleanupGenerations;
            ++state.ownerTransitions;
            return;
        }

        if (eventKind == "cleanup.rearm") {
            // Reassignment closes the previous generation and immediately
            // installs the replacement under the same lexical owner.
            if (dynamic.active) {
                ++state.ownerTransitions;
            }
            dynamic.active = true;
            dynamic.lostReported = false;
            dynamic.terminalKind.clear();
            ++dynamic.generation;
            ++state.dynamicCleanupGenerations;
            ++state.ownerTransitions;
            return;
        }

        if (!dynamic.active) {
            if (eventKind == "cleanup.skip") {
                return;
            }
            const auto duplicate = dynamic.terminalKind == eventKind;
            addAnomaly(
                state,
                duplicate ? (eventKind == "cleanup.execute" ? "cleanup.duplicate_execution" : "cleanup.duplicate_cancel") : "cleanup.transition_without_obligation",
                "cleanup transition has no active dynamic obligation: " + cleanupId,
                eventId,
                source);
            return;
        }

        dynamic.active = false;
        dynamic.terminalKind = eventKind;
        ++state.ownerTransitions;

        if (eventKind == "cleanup.execute") {
            static const std::set<std::string> validExitReasons = {
                "normal",
                "return",
                "break",
                "continue",
            };
            if (!validExitReasons.contains(exitReason)) {
                addAnomaly(state, "cleanup.invalid_exit_reason", "cleanup execution has invalid exit reason '" + exitReason + "'", eventId, source);
            }
        }
    }

    void recordFrameEvent(const std::string& eventKind, const std::string& producer, const std::string& entityId, const std::string& eventId, const std::string& source, const llvm::json::Object* details, AnalyzerState& state) {
        if (!details) {
            addAnomaly(state, "frame.details", "function frame event is missing details", eventId, source);
            return;
        }

        const auto frameId = static_cast<std::uint64_t>(integerValue(*details, "frameId"));
        if (frameId == 0 || entityId.empty()) {
            addAnomaly(state, "frame.identity", "function frame event is missing stable identity", eventId, source);
            return;
        }

        auto& stack = state.frameStacks[producer];
        if (eventKind == "function.frame.enter") {
            const auto parentFrameId = static_cast<std::uint64_t>(integerValue(*details, "parentFrameId"));
            std::uint64_t actualParentFrameId = 0;
            if (!stack.empty()) {
                const auto parent = state.frames.find(stack.back());
                if (parent != state.frames.end()) {
                    actualParentFrameId = parent->second.frameId;
                }
            }

            if (parentFrameId != actualParentFrameId) {
                addAnomaly(state, "frame.parent_mismatch", "frame " + std::to_string(frameId) + " declared parent " + std::to_string(parentFrameId) + ", active parent is " + std::to_string(actualParentFrameId), eventId, source);
            }

            auto& frame = state.frames[entityId];
            frame.producer = producer;
            frame.entityId = entityId;
            frame.entryEventId = eventId;
            frame.source = source;
            frame.frameId = frameId;
            frame.parentFrameId = parentFrameId;
            frame.active = true;
            stack.push_back(entityId);
            return;
        }

        const auto iterator = state.frames.find(entityId);
        if (iterator == state.frames.end() || !iterator->second.active) {
            addAnomaly(state, "frame.invalid_exit", "function frame exited without an active enter: " + entityId, eventId, source);
            return;
        }

        if (stack.empty() || stack.back() != entityId) {
            addAnomaly(state, "frame.non_lifo_exit", "function frames did not exit in LIFO order: " + entityId, eventId, source);
        } else {
            stack.pop_back();
        }

        const auto exitReason = stringValue(*details, "exitReason");
        if (exitReason != "normal" && exitReason != "return") {
            addAnomaly(state, "frame.invalid_exit_reason", "function frame has invalid exit reason '" + exitReason + "'", eventId, source);
        }

        for (auto& [key, cleanup] : state.runtimeCleanups) {
            (void)key;
            if (cleanup.producer == producer && cleanup.frameId == frameId && cleanup.active) {
                addAnomaly(state, "cleanup.lost_obligation", "frame exited while cleanup obligation remained active: " + cleanup.cleanupId + " for owner '" + cleanup.owner + "'", cleanup.lastEventId, cleanup.source);
                cleanup.lostReported = true;
            }
        }

        iterator->second.exitEventId = eventId;
        iterator->second.exitReason = exitReason;
        iterator->second.active = false;
        ++state.completedFrames;
    }

    void reduceEvent(const llvm::json::Object& event, AnalyzerState& state) {
        const auto eventId = stringValue(event, "eventId");
        const auto eventKind = stringValue(event, "eventKind");
        const auto category = stringValue(event, "category");
        const auto entityId = stringValue(event, "entityId");
        const auto producer = stringValue(event, "producer");
        const auto phase = stringValue(event, "phase");
        const auto sequence = static_cast<std::uint64_t>(integerValue(event, "sequence"));
        const auto source = sourceText(event);
        const auto* details = event.getObject("details");

        ++state.eventCount;
        ++state.eventKindCounts[eventKind];

        std::ostringstream timeline;
        timeline << phase << ' ' << producer << ' ' << sequence << ' ' << eventKind;
        if (!entityId.empty()) {
            timeline << ' ' << entityId;
        }
        timeline << " @ " << source;
        state.timeline.push_back(timeline.str());

        if (category == "anomaly" || eventKind.rfind("anomaly.", 0) == 0) {
            const auto reason = details ? stringValue(*details, "reason") : std::string("runtime anomaly");
            addAnomaly(state, "runtime.anomaly", reason, eventId, source);
            return;
        }

        if (eventKind == "semantic.decision.plan" || eventKind == "sir.decision.read" || eventKind == "lowering.decision.consume" || eventKind == "semantic.decision.execute") {
            recordDecisionEvent(phase, eventKind, producer, sequence, eventId, source, details, state);
            return;
        }

        if (eventKind == "cleanup.schedule" || eventKind == "cleanup.activate" || eventKind == "cleanup.rearm" || eventKind == "cleanup.cancel" || eventKind == "cleanup.emit" || eventKind == "cleanup.execute" || eventKind == "cleanup.skip") {
            recordCleanupEvent(phase, eventKind, producer, eventId, source, details, state);
            return;
        }

        if (eventKind == "process.summary") {
            ++state.processSummaries;
            if (details && details->getBoolean("droppedEvents").value_or(false)) {
                addAnomaly(state, "trace.dropped_events", "runtime reported dropped observability events", eventId, source);
            }

            if (details) {
                const auto separator = producer.find(':');
                const auto processSuffix = separator == std::string::npos ? std::string() : producer.substr(separator + 1);
                std::size_t liveAllocations = 0;
                std::size_t liveAggregates = 0;
                std::size_t liveResources = 0;

                for (const auto& [candidateId, entity] : state.entities) {
                    if (!entity.alive || processSuffix.empty()) {
                        continue;
                    }

                    const auto processToken = ':' + processSuffix + ':';
                    if (candidateId.find(processToken) == std::string::npos) {
                        continue;
                    }

                    if (entity.category == "memory") {
                        ++liveAllocations;
                    } else if (entity.category == "aggregate") {
                        ++liveAggregates;
                    } else if (entity.category == "resource") {
                        ++liveResources;
                    }
                }

                const auto checkSummaryCount = [&](llvm::StringRef field, std::size_t actual) {
                    const auto expected = details->getInteger(field);
                    if (expected && static_cast<std::size_t>(*expected) != actual) {
                        addAnomaly(state, "trace.summary_mismatch", field.str() + " summary reported " + std::to_string(*expected) + ", reconstructed " + std::to_string(actual), eventId, source);
                    }
                };

                checkSummaryCount("liveAllocations", liveAllocations);
                checkSummaryCount("liveAggregates", liveAggregates);
                checkSummaryCount("liveResources", liveResources);
            }
            return;
        }

        const auto typeName = details ? stringValue(*details, "typeName") : std::string();
        if (eventKind == "memory.allocate") {
            transitionCreate(entityId, "memory", typeName, eventId, source, details ? integerValue(*details, "generation") : 0, state);
            return;
        }

        if (eventKind == "memory.reallocate") {
            auto iterator = state.entities.find(entityId);
            const auto generation = details ? integerValue(*details, "generation") : 0;
            if (iterator == state.entities.end() || !iterator->second.alive) {
                addAnomaly(state, "memory.invalid_reallocate", "reallocation has no live allocation: " + entityId, eventId, source);
                return;
            }

            if (generation != iterator->second.generation + 1) {
                addAnomaly(state, "memory.generation", "reallocation generation is not previous generation + 1: " + entityId, eventId, source);
            }
            iterator->second.generation = generation;
            iterator->second.typeName = typeName;
            iterator->second.lastEventId = eventId;
            return;
        }

        if (eventKind == "memory.free") {
            transitionDestroy(entityId, "memory", eventId, source, state);
            return;
        }

        if (eventKind == "aggregate.create") {
            transitionCreate(entityId, "aggregate", typeName, eventId, source, 0, state);
            return;
        }

        if (eventKind == "aggregate.destroy") {
            transitionDestroy(entityId, "aggregate", eventId, source, state);
            return;
        }

        if (eventKind == "resource.create") {
            transitionCreate(entityId, "resource", typeName, eventId, source, 0, state);
            return;
        }

        if (eventKind == "resource.destroy") {
            transitionDestroy(entityId, "resource", eventId, source, state);
            return;
        }

        if (eventKind == "function.frame.enter") {
            recordFrameEvent(eventKind, producer, entityId, eventId, source, details, state);
            transitionCreate(entityId, "frame", "", eventId, source, 0, state);
            return;
        }

        if (eventKind == "function.frame.exit") {
            recordFrameEvent(eventKind, producer, entityId, eventId, source, details, state);
            transitionDestroy(entityId, "frame", eventId, source, state);
        }
    }

    void readEventFile(const std::filesystem::path& path, AnalyzerState& state) {
        std::ifstream input(path);
        if (!input) {
            addAnomaly(state, "trace.read", "cannot read trace file: " + path.string());
            return;
        }

        std::string line;
        std::size_t lineNumber = 0;
        while (std::getline(input, line)) {
            ++lineNumber;
            if (line.empty()) {
                continue;
            }

            auto parsed = llvm::json::parse(line);
            if (!parsed) {
                addAnomaly(state, "event.parse", "invalid JSON event", {}, path.string() + ':' + std::to_string(lineNumber));
                continue;
            }

            const auto* event = parsed->getAsObject();
            if (!event) {
                addAnomaly(state, "event.shape", "event must be a JSON object", {}, path.string() + ':' + std::to_string(lineNumber));
                continue;
            }

            if (validateEnvelope(*event, path, lineNumber, state)) {
                reduceEvent(*event, state);
            }
        }
    }

    void reduceOwnershipAndBorrows(AnalyzerState& state) {
        std::sort(state.decisionExecutions.begin(), state.decisionExecutions.end(), [](const DecisionExecution& left, const DecisionExecution& right) {
            if (left.producer != right.producer) {
                return left.producer < right.producer;
            }
            return left.sequence < right.sequence;
        });

        for (const auto& execution : state.decisionExecutions) {
            const auto iterator = state.decisions.find(execution.decisionId);
            if (iterator == state.decisions.end()) {
                continue;
            }

            const auto& decision = iterator->second;
            const auto source = std::find_if(decision.relatedIds.begin(), decision.relatedIds.end(), [](const std::string& relatedId) {
                return relatedId.rfind("value:", 0) == 0 || relatedId.rfind("symbol:", 0) == 0;
            });

            if (decision.kind == "Move") {
                if (source == decision.relatedIds.end()) {
                    addAnomaly(state, "owner.missing_source", "runtime move decision does not identify its source owner: " + execution.decisionId, execution.eventId, execution.source);
                    continue;
                }
                ++state.ownerTransitions;
                continue;
            }

            if (decision.kind == "Borrow") {
                if (source == decision.relatedIds.end()) {
                    addAnomaly(state, "borrow.missing_source", "runtime borrow decision does not identify its borrowed source: " + execution.decisionId, execution.eventId, execution.source);
                    continue;
                }

                // Current Yogi borrows represented by semantic decisions are
                // expression/call scoped. The reducer observes a complete,
                // non-owning interval at this execution point.
                ++state.borrowObservations;
            }
        }
    }

    void checkFinalState(const Manifest& manifest, bool observabilityEnabled, AnalyzerState& state) {
        reduceOwnershipAndBorrows(state);

        if (observabilityEnabled && manifest.profile == "runtime-strict" && state.processSummaries == 0) {
            addAnomaly(state, "trace.missing_summary", "runtime-strict Program Test did not emit a process summary");
        }

        for (const auto& [entityId, entity] : state.entities) {
            if (!entity.alive) {
                continue;
            }

            if (manifest.allowedLiveEntities.contains({entity.category, entity.typeName}) || manifest.allowedLiveEntities.contains({"*", entity.typeName})) {
                ++state.allowedLiveEntities;
                continue;
            }

            addAnomaly(state, entity.category + ".unexpected_live", entity.category + " entity remains alive: " + entityId + (entity.typeName.empty() ? "" : " (" + entity.typeName + ")"), entity.lastEventId);
        }

        for (const auto& expectation : manifest.countExpectations) {
            const auto actual = state.eventKindCounts[expectation.eventKind];
            if (actual != static_cast<std::size_t>(expectation.equals)) {
                addAnomaly(state, "expectation.count", "expected " + std::to_string(expectation.equals) + " events of kind " + expectation.eventKind + ", observed " + std::to_string(actual));
            }
        }

        for (const auto& [decisionId, decision] : state.decisions) {
            if (manifest.profile != "runtime-strict") {
                continue;
            }

            if (decision.planEventId.empty()) {
                addAnomaly(state, "decision.missing_plan", "SIR/lowering/runtime referenced an unplanned semantic decision: " + decisionId, decision.loweringEventId, decision.source);
                continue;
            }
            if (decision.sirEventId.empty()) {
                addAnomaly(state, "decision.missing_sir", "planned semantic decision was not recovered from SIR: " + decisionId, decision.planEventId, decision.source);
            }
            if (decision.loweringEventId.empty()) {
                addAnomaly(state, "decision.missing_lowering", "planned semantic decision was not consumed by lowering: " + decisionId, decision.planEventId, decision.source);
            }
        }

        for (const auto& expectation : manifest.decisionExpectations) {
            std::size_t planned = 0;
            std::size_t lowered = 0;
            std::size_t runtime = 0;

            for (const auto& [decisionId, decision] : state.decisions) {
                (void)decisionId;
                if ((!expectation.decisionKind.empty() && decision.kind != expectation.decisionKind) || (!expectation.decisionReason.empty() && decision.reason != expectation.decisionReason)) {
                    continue;
                }

                planned += decision.planEventId.empty() ? 0 : 1;
                lowered += decision.loweringEventId.empty() ? 0 : 1;
                runtime += decision.runtimeExecutions;
            }

            const auto label = expectation.decisionKind + (expectation.decisionReason.empty() ? "" : "/" + expectation.decisionReason);
            if (planned < static_cast<std::size_t>(expectation.plannedAtLeast)) {
                addAnomaly(state, "expectation.decision_plan", "expected at least " + std::to_string(expectation.plannedAtLeast) + " planned " + label + " decisions, observed " + std::to_string(planned));
            }
            if (lowered < static_cast<std::size_t>(expectation.loweredAtLeast)) {
                addAnomaly(state, "expectation.decision_lowering", "expected at least " + std::to_string(expectation.loweredAtLeast) + " lowered " + label + " decisions, observed " + std::to_string(lowered));
            }
            if (runtime < static_cast<std::size_t>(expectation.runtimeAtLeast)) {
                addAnomaly(state, "expectation.decision_runtime", "expected at least " + std::to_string(expectation.runtimeAtLeast) + " runtime " + label + " decisions, observed " + std::to_string(runtime));
            }
        }

        for (const auto& [cleanupId, cleanup] : state.cleanups) {
            if (manifest.profile != "runtime-strict") {
                continue;
            }

            if (cleanup.scheduleEventId.empty()) {
                addAnomaly(state, "cleanup.missing_schedule", "cleanup event referenced an unscheduled obligation: " + cleanupId, {}, cleanup.source);
                continue;
            }
            if (cleanup.emissions == 0 && cleanup.cancellations == 0) {
                addAnomaly(state, "cleanup.missing_emission", "scheduled cleanup was neither emitted nor cancelled: " + cleanupId, cleanup.scheduleEventId, cleanup.source);
            }
            if (cleanup.runtimeExecutions > 0 && cleanup.emissions == 0) {
                addAnomaly(state, "cleanup.execute_without_emission", "runtime executed cleanup without a lowered cleanup site: " + cleanupId, {}, cleanup.source);
            }
            for (const auto& [exitReason, count] : cleanup.runtimeByExit) {
                if (count > 0 && !cleanup.emissionExitReasons.contains(exitReason)) {
                    addAnomaly(state, "cleanup.wrong_exit_path", "runtime executed cleanup " + cleanupId + " on '" + exitReason + "' but lowering emitted no matching path", {}, cleanup.source);
                }
            }
        }

        for (const auto& [key, cleanup] : state.runtimeCleanups) {
            (void)key;
            if (cleanup.active && !cleanup.lostReported) {
                addAnomaly(state, "cleanup.lost_obligation", "dynamic cleanup obligation remained active after trace completion: " + cleanup.cleanupId + " for owner '" + cleanup.owner + "'", cleanup.lastEventId, cleanup.source);
            }
        }

        for (const auto& [producer, stack] : state.frameStacks) {
            if (!stack.empty()) {
                addAnomaly(state, "frame.unclosed_stack", "producer " + producer + " ended with " + std::to_string(stack.size()) + " active frame(s)");
            }
        }

        for (const auto& expectation : manifest.cleanupExpectations) {
            std::size_t scheduled = 0;
            std::size_t emitted = 0;
            std::size_t cancelled = 0;
            std::size_t runtime = 0;

            for (const auto& [cleanupId, cleanup] : state.cleanups) {
                (void)cleanupId;
                if ((!expectation.owner.empty() && cleanup.owner != expectation.owner) || (!expectation.cleanupKind.empty() && cleanup.cleanupKind != expectation.cleanupKind) ||
                    (!expectation.destroyFunction.empty() && cleanup.destroyFunction != expectation.destroyFunction)) {
                    continue;
                }

                scheduled += cleanup.scheduleEventId.empty() ? 0 : 1;
                emitted += cleanup.emissions;
                cancelled += cleanup.cancellations;
                runtime += cleanup.runtimeExecutions;
            }

            const auto label = (expectation.owner.empty() ? std::string("cleanup") : "cleanup for '" + expectation.owner + "'");
            if (scheduled < static_cast<std::size_t>(expectation.scheduledAtLeast)) {
                addAnomaly(state, "expectation.cleanup_schedule", "expected at least " + std::to_string(expectation.scheduledAtLeast) + " scheduled " + label + ", observed " + std::to_string(scheduled));
            }
            if (emitted < static_cast<std::size_t>(expectation.emittedAtLeast)) {
                addAnomaly(state, "expectation.cleanup_emission", "expected at least " + std::to_string(expectation.emittedAtLeast) + " emitted sites for " + label + ", observed " + std::to_string(emitted));
            }
            if (cancelled < static_cast<std::size_t>(expectation.cancelledAtLeast)) {
                addAnomaly(state, "expectation.cleanup_cancel", "expected at least " + std::to_string(expectation.cancelledAtLeast) + " cancellations for " + label + ", observed " + std::to_string(cancelled));
            }
            if (runtime < static_cast<std::size_t>(expectation.runtimeAtLeast)) {
                addAnomaly(state, "expectation.cleanup_runtime", "expected at least " + std::to_string(expectation.runtimeAtLeast) + " runtime executions for " + label + ", observed " + std::to_string(runtime));
            }
            for (const auto& [exitReason, expected] : expectation.runtimeByExit) {
                std::size_t actual = 0;
                for (const auto& [cleanupId, cleanup] : state.cleanups) {
                    (void)cleanupId;
                    if ((!expectation.owner.empty() && cleanup.owner != expectation.owner) || (!expectation.cleanupKind.empty() && cleanup.cleanupKind != expectation.cleanupKind) ||
                        (!expectation.destroyFunction.empty() && cleanup.destroyFunction != expectation.destroyFunction)) {
                        continue;
                    }
                    const auto count = cleanup.runtimeByExit.find(exitReason);
                    actual += count == cleanup.runtimeByExit.end() ? 0 : count->second;
                }

                if (actual < static_cast<std::size_t>(expected)) {
                    addAnomaly(state, "expectation.cleanup_exit", "expected at least " + std::to_string(expected) + " '" + exitReason + "' runtime cleanups for " + label + ", observed " + std::to_string(actual));
                }
            }
        }
    }

    void inspectIr(const std::filesystem::path& artifactRoot, const Manifest& manifest, AnalyzerState& state) {
        if (artifactRoot.empty()) {
            return;
        }

        const auto result = yogi::testing::ProgramIrInspector::inspect(artifactRoot, manifest.irExpectations);
        state.llvmModules = result.moduleCount;
        for (const auto& anomaly : result.anomalies) {
            addAnomaly(state, anomaly.code, anomaly.message, {}, anomaly.source);
        }
    }

    void writeResults(const std::filesystem::path& traceDirectory, const std::string& testName, const AnalyzerState& state) {
        std::ofstream summary(traceDirectory / "summary.json");
        summary << "{\n  \"schemaVersion\": 1,\n  \"test\": ";
        writeJsonString(summary, testName);
        summary << ",\n  \"status\": " << (state.anomalies.empty() ? "\"pass\"" : "\"fail\"") << ",\n  \"eventCount\": " << state.eventCount << ",\n  \"processSummaries\": " << state.processSummaries
                << ",\n  \"semanticDecisions\": " << state.decisions.size() << ",\n  \"cleanupObligations\": " << state.cleanups.size() << ",\n  \"llvmModules\": " << state.llvmModules << ",\n  \"allowedLiveEntities\": " << state.allowedLiveEntities
                << ",\n  \"ownerTransitions\": " << state.ownerTransitions << ",\n  \"borrowObservations\": " << state.borrowObservations << ",\n  \"completedFrames\": " << state.completedFrames
                << ",\n  \"dynamicCleanupGenerations\": " << state.dynamicCleanupGenerations << ",\n  \"anomalyCount\": " << state.anomalies.size() << "\n}\n";

        std::ofstream anomalies(traceDirectory / "anomalies.json");
        anomalies << "{\n  \"schemaVersion\": 1,\n  \"anomalies\": [";
        for (std::size_t index = 0; index < state.anomalies.size(); ++index) {
            const auto& anomaly = state.anomalies[index];
            anomalies << (index == 0 ? "\n" : ",\n") << "    {\"code\":";
            writeJsonString(anomalies, anomaly.code);
            anomalies << ",\"message\":";
            writeJsonString(anomalies, anomaly.message);
            anomalies << ",\"eventId\":";
            writeJsonString(anomalies, anomaly.eventId);
            anomalies << ",\"source\":";
            writeJsonString(anomalies, anomaly.source);
            anomalies << '}';
        }
        anomalies << (state.anomalies.empty() ? "" : "\n  ") << "]\n}\n";

        std::ofstream timeline(traceDirectory / "timeline.txt");
        for (const auto& event : state.timeline) {
            timeline << event << '\n';
        }
    }

    bool parseBoolean(const std::string& value) {
        return value == "1" || value == "true" || value == "ON";
    }

} // namespace

int main(int argc, char** argv) {
    std::filesystem::path traceDirectory;
    std::filesystem::path manifestPath;
    std::filesystem::path artifactRoot;
    std::string testName;
    bool observabilityEnabled = false;

    for (int index = 1; index < argc; ++index) {
        const std::string argument = argv[index];
        if (argument == "--trace-dir" && index + 1 < argc) {
            traceDirectory = argv[++index];
        } else if (argument == "--manifest" && index + 1 < argc) {
            manifestPath = argv[++index];
        } else if (argument == "--test" && index + 1 < argc) {
            testName = argv[++index];
        } else if (argument == "--observability-enabled" && index + 1 < argc) {
            observabilityEnabled = parseBoolean(argv[++index]);
        } else if (argument == "--artifact-root" && index + 1 < argc) {
            artifactRoot = argv[++index];
        }
    }

    if (traceDirectory.empty() || manifestPath.empty() || testName.empty()) {
        std::cerr << "usage: yogi_program_trace_analyzer --trace-dir <dir> --manifest <file> "
                     "--test <name> --observability-enabled <0|1> [--artifact-root <dir>]\n";
        return 2;
    }

    AnalyzerState state;
    const auto manifest = readManifest(manifestPath, state);

    std::vector<std::filesystem::path> eventFiles;
    if (std::filesystem::exists(traceDirectory)) {
        for (const auto& entry : std::filesystem::directory_iterator(traceDirectory)) {
            if (entry.is_regular_file() && entry.path().filename().string().ends_with(".events.jsonl")) {
                eventFiles.push_back(entry.path());
            }
        }
    }
    std::sort(eventFiles.begin(), eventFiles.end());

    for (const auto& path : eventFiles) {
        readEventFile(path, state);
    }

    inspectIr(artifactRoot, manifest, state);
    checkFinalState(manifest, observabilityEnabled, state);
    writeResults(traceDirectory, testName, state);

    if (!state.anomalies.empty()) {
        const auto& first = state.anomalies.front();
        std::cerr << "Program Observability failed: " << first.code << ": " << first.message;
        if (!first.eventId.empty()) {
            std::cerr << "\nfirst event: " << first.eventId;
        }
        if (!first.source.empty()) {
            std::cerr << "\nsource: " << first.source;
        }
        std::cerr << "\nfull report: " << (traceDirectory / "anomalies.json") << '\n';
        return 1;
    }

    return 0;
}
