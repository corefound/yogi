import { BaseSemantic, Constructor } from "./base";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

export function TypesSemantic<TBase extends Constructor<BaseSemantic>>(
    base: TBase,
) {
    return class extends base {
        public visitAliasTypes(node: any): any {
            switch (node.kind) {
                case Kinds.Types.TypeDeclaration:
                case "TypeDeclaration":
                    return this.visitTypeDeclaration(node);

                case Kinds.Types.InterfaceDeclaration:
                case "InterfaceDeclaration":
                    return this.visitInterfaceDeclaration(node);

                default:
                    return null;
            }
        }

        public visitTypeDeclaration(node: any): any {
            return this.visitTypeLikeDeclaration(node, "type");
        }

        public visitInterfaceDeclaration(node: any): any {
            return this.visitTypeLikeDeclaration(node, "interface");
        }

        public visitTypeLikeDeclaration(
            node: any,
            declarationKind: "type" | "interface",
        ): any {
            this.typeLikeDeclarationDiagnostics(node, declarationKind);

            const name = this.getNameText(node.name);
            const body = this.getTypeBody(node);

            const ownMembers =
                declarationKind === "interface" || this.isTypeLiteral(body)
                    ? this.checkTypeMembers(node, declarationKind)
                    : [];

            const members =
                declarationKind === "interface"
                    ? this.resolveInterfaceExtends(node, ownMembers)
                    : ownMembers;

            const localSymbol = this.resolveLocalSymbol(name);

            if (
                declarationKind === "interface" &&
                localSymbol?.kind === Kinds.ScopeSymbols.Interface
            ) {
                return this.mergeInterfaceDeclaration(node, localSymbol, members);
            }

            const linkageName = node.export
                ? this.getLinkageName(this.modulePath.relativePath, name)
                : null;

            const qualifiedName = this.getQualifiedName(
                this.modulePath.relativePath,
                name,
            );

            const declarationInfo = this.getDeclarationInfo(node, ownMembers);

            const semanticType =
                declarationKind === "interface"
                    ? {
                        ...body,
                        members,
                    }
                    : body;

            const semanticNode: any = {
                ...node,

                kind:
                    declarationKind === "interface"
                        ? Kinds.Types.InterfaceDeclaration
                        : Kinds.Types.TypeDeclaration,

                declarationKind,

                name: node.name,
                nameText: name,

                body: declarationKind === "interface" ? semanticType : node.body,

                /**
                 * For type aliases, this can be any TypeNode.
                 * For interfaces, this is always the resolved TypeLiteral body.
                 */
                type: semanticType,

                parameters: node.parameters ?? node.typeParameters ?? [],

                export: node.export ?? false,
                linkageName,
                qualifiedName,

                trusted: true,
                merged: false,
                declarations: [declarationInfo],
            };

            const symbol = this.defineSymbol({
                kind:
                    declarationKind === "interface"
                        ? Kinds.ScopeSymbols.Interface
                        : Kinds.ScopeSymbols.Type,

                name,
                type: semanticNode.type,
                mutable: false,
                storage: null,
                escapes: false,
                linkageName,
                qualifiedName,
                node: null,
            });

            semanticNode.symbolId = symbol.id;
            semanticNode.scopeId = symbol.scopeId;

            symbol.node = semanticNode;

            if (node.export) {
                this.exportSymbol(symbol);
            }

            return [];
        }

        public resolveInterfaceExtends(node: any, ownMembers: any[]): any[] {
            const extendedTypes = node.extends ?? [];

            if (!extendedTypes.length) {
                return ownMembers;
            }

            const interfaceName = this.getNameText(node.name);
            const inheritedMembers: any[] = [];

            for (const extended of extendedTypes) {
                const extendedName = this.getTypeUsageNameText(extended);

                if (extendedName === interfaceName) {
                    const message =
                        `interface ${Helpers.RED}'${interfaceName}'${Helpers.RESET} cannot extend itself`;

                    extended.arrowLength = extended.raw?.length ?? extendedName.length;

                    this.throwError(
                        message,
                        extended.position,
                        node.raw ?? node.source,
                        extended,
                    );
                }

                const symbol = this.resolveSymbol(extendedName);

                if (!symbol) {
                    const message =
                        `cannot find type ${Helpers.RED}'${extendedName}'${Helpers.RESET}`;

                    extended.arrowLength = extended.raw?.length ?? extendedName.length;

                    this.throwError(
                        message,
                        extended.position,
                        node.raw ?? node.source,
                        extended,
                    );
                }

                if (!this.canInterfaceExtendSymbol(symbol)) {
                    const message =
                        `interface ${Helpers.RED}'${interfaceName}'${Helpers.RESET} can only extend an object-like type with statically known members; ` +
                        `${Helpers.RED}'${extendedName}'${Helpers.RESET} is not valid`;

                    extended.arrowLength = extended.raw?.length ?? extendedName.length;

                    this.throwError(
                        message,
                        extended.position,
                        node.raw ?? node.source,
                        extended,
                    );
                }

                this.checkTypeArguments(extended, symbol);

                const members = this.getExtensibleMembersFromSymbol(symbol);

                inheritedMembers.push(
                    ...members.map((member: any) => ({
                        ...member,
                        inherited: true,
                        inheritedFrom: symbol.name,
                        inheritedFromSymbolId: symbol.id,
                    })),
                );
            }

            return this.combineInheritedAndOwnMembers(
                node,
                inheritedMembers,
                ownMembers,
            );
        }

        public combineInheritedAndOwnMembers(
            node: any,
            inheritedMembers: any[],
            ownMembers: any[],
        ): any[] {
            const interfaceName = this.getNameText(node.name);
            const membersByName = new Map<string, any>();
            const finalMembers: any[] = [];

            const addMember = (member: any, isOwnMember: boolean): void => {
                const memberName = this.getMemberNameText(member);

                /**
                 * Call signatures, construct signatures, and index signatures
                 * do not behave like normal named properties.
                 *
                 * Keep them as separate members.
                 */
                if (!memberName) {
                    finalMembers.push(member);
                    return;
                }

                /**
                 * Methods can be overloaded in TypeScript, so do not
                 * deduplicate MethodSignature only by name.
                 */
                if (this.isOverloadMember(member)) {
                    finalMembers.push(member);
                    return;
                }

                const previous = membersByName.get(memberName);

                if (previous) {
                    if (!this.areMembersCompatible(previous, member)) {
                        const message = isOwnMember
                            ? `member ${Helpers.RED}'${memberName}'${Helpers.RESET} conflicts with inherited member in interface ` +
                            `${Helpers.RED}'${interfaceName}'${Helpers.RESET}`
                            : `inherited member ${Helpers.RED}'${memberName}'${Helpers.RESET} has conflicting declarations in interface ` +
                            `${Helpers.RED}'${interfaceName}'${Helpers.RESET}`;

                        member.arrowLength = member.raw?.length ?? memberName.length;

                        this.throwError(
                            message,
                            member.position,
                            node.raw ?? node.source,
                            member,
                        );
                    }

                    /**
                     * Same member, same type, same optional/readonly state.
                     * Do not add it again.
                     */
                    return;
                }

                membersByName.set(memberName, member);
                finalMembers.push(member);
            };

            for (const member of inheritedMembers) {
                addMember(member, false);
            }

            for (const member of ownMembers) {
                addMember(member, true);
            }

            return finalMembers;
        }

        public typeLikeDeclarationDiagnostics(
            context: any,
            declarationKind: "type" | "interface",
        ): void {
            const name = this.getNameText(context.name);
            const body = this.getTypeBody(context);

            const localSymbol = this.resolveLocalSymbol(name);

            if (localSymbol) {
                const canMerge =
                    declarationKind === "interface" &&
                    localSymbol.kind === Kinds.ScopeSymbols.Interface;

                if (canMerge) {
                    this.checkInterfaceMergeCompatibility(context, localSymbol);
                    return;
                }

                const message =
                    `${declarationKind} name ${Helpers.RED}'${name}'${Helpers.RESET} is defined multiple times`;

                context.arrowLength = name.length;

                this.throwError(
                    message,
                    this.getNamePosition(context.name) ?? context.position,
                    context.raw ?? context.source,
                    context,
                );
            }

            if (!body) {
                const message =
                    `${declarationKind} declaration ${Helpers.RED}'${name}'${Helpers.RESET} is missing a type body`;

                context.arrowLength = name.length;

                this.throwError(
                    message,
                    this.getNamePosition(context.name) ?? context.position,
                    context.raw ?? context.source,
                    context,
                );
            }

            if (declarationKind === "interface" && !this.isTypeLiteral(body)) {
                const message =
                    `interface declaration ${Helpers.RED}'${name}'${Helpers.RESET} must have a type literal body`;

                context.arrowLength = name.length;

                this.throwError(
                    message,
                    body.position ?? context.position,
                    context.raw ?? context.source,
                    body,
                );
            }
        }

        public checkTypeMembers(
            context: any,
            declarationKind: "type" | "interface",
        ): any[] {
            const body = this.getTypeBody(context);
            const members = body?.members ?? [];
            const names = new Map<string, any>();
            const contextName = this.getNameText(context.name);

            return members.map((member: any) => {
                const memberKind = member.kind;

                const isProperty =
                    memberKind === Kinds.Types.PropertySignature ||
                    memberKind === "PropertySignature";

                const isMethod =
                    memberKind === Kinds.Types.MethodSignature ||
                    memberKind === "MethodSignature";

                const isCall =
                    memberKind === Kinds.Types.CallSignature ||
                    memberKind === "CallSignature";

                const isConstruct =
                    memberKind === Kinds.Types.ConstructSignature ||
                    memberKind === "ConstructSignature";

                const isIndex =
                    memberKind === Kinds.Types.IndexSignature ||
                    memberKind === "IndexSignature";

                const isValidInterfaceMember =
                    isProperty || isMethod || isCall || isConstruct || isIndex;

                if (!isValidInterfaceMember) {
                    const message =
                        `invalid member in ${declarationKind} declaration ` +
                        `${Helpers.RED}'${contextName}'${Helpers.RESET}`;

                    member.arrowLength = member.raw?.length ?? 1;

                    this.throwError(
                        message,
                        member.position ?? context.position,
                        context.raw ?? context.source,
                        member,
                    );
                }

                if (isProperty) {
                    this.checkPropertySignature(context, member, names, declarationKind);
                }

                if (isMethod) {
                    this.checkMethodSignature(context, member);
                }

                if (isCall) {
                    this.checkCallSignature(context, member);
                }

                if (isConstruct) {
                    this.checkConstructSignature(context, member);
                }

                if (isIndex) {
                    this.checkIndexSignature(context, member);
                }

                return {
                    ...member,
                    nameText: this.getMemberNameText(member),
                    trusted: true,
                };
            });
        }

        public checkPropertySignature(
            context: any,
            member: any,
            names: Map<string, any>,
            declarationKind: "type" | "interface",
        ): void {
            const contextName = this.getNameText(context.name);
            const memberName = this.getMemberNameText(member);

            if (!memberName) {
                return;
            }

            if (names.has(memberName)) {
                const previous = names.get(memberName);

                if (!this.areMembersCompatible(previous, member)) {
                    const message =
                        `property ${Helpers.RED}'${memberName}'${Helpers.RESET} is defined multiple times with incompatible declarations in ` +
                        `${declarationKind} ${Helpers.RED}'${contextName}'${Helpers.RESET}`;

                    member.arrowLength = member.raw?.length ?? memberName.length;

                    this.throwError(
                        message,
                        member.position,
                        context.raw ?? context.source,
                        member,
                    );
                }

                return;
            }

            names.set(memberName, member);

            if (!member.type || member.type.kind === Kinds.Types.UnTyped) {
                const message =
                    `property ${Helpers.RED}'${memberName}'${Helpers.RESET} is missing a type annotation`;

                member.arrowLength = member.raw?.length ?? memberName.length;

                this.throwError(
                    message,
                    member.position,
                    context.raw ?? context.source,
                    member,
                );
            }
        }

        public checkMethodSignature(context: any, member: any): void {
            const contextName = this.getNameText(context.name);
            const memberName = this.getMemberNameText(member) ?? "<computed>";

            if (!member.returnType || member.returnType.kind === Kinds.Types.UnTyped) {
                const message =
                    `method ${Helpers.RED}'${memberName}'${Helpers.RESET} in interface ` +
                    `${Helpers.RED}'${contextName}'${Helpers.RESET} is missing a return type`;

                member.arrowLength = member.raw?.length ?? memberName.length;

                this.throwError(
                    message,
                    member.position,
                    context.raw ?? context.source,
                    member,
                );
            }

            this.checkParameters(context, member.parameters ?? [], member);
        }

        public checkCallSignature(context: any, member: any): void {
            if (!member.returnType || member.returnType.kind === Kinds.Types.UnTyped) {
                const contextName = this.getNameText(context.name);

                const message =
                    `call signature in interface ${Helpers.RED}'${contextName}'${Helpers.RESET} is missing a return type`;

                member.arrowLength = member.raw?.length ?? 1;

                this.throwError(
                    message,
                    member.position,
                    context.raw ?? context.source,
                    member,
                );
            }

            this.checkParameters(context, member.parameters ?? [], member);
        }

        public checkConstructSignature(context: any, member: any): void {
            if (!member.returnType || member.returnType.kind === Kinds.Types.UnTyped) {
                const contextName = this.getNameText(context.name);

                const message =
                    `construct signature in interface ${Helpers.RED}'${contextName}'${Helpers.RESET} is missing a return type`;

                member.arrowLength = member.raw?.length ?? 1;

                this.throwError(
                    message,
                    member.position,
                    context.raw ?? context.source,
                    member,
                );
            }

            this.checkParameters(context, member.parameters ?? [], member);
        }

        public checkIndexSignature(context: any, member: any): void {
            const contextName = this.getNameText(context.name);

            if (!member.returnType || member.returnType.kind === Kinds.Types.UnTyped) {
                const message =
                    `index signature in interface ${Helpers.RED}'${contextName}'${Helpers.RESET} is missing a return type`;

                member.arrowLength = member.raw?.length ?? 1;

                this.throwError(
                    message,
                    member.position,
                    context.raw ?? context.source,
                    member,
                );
            }

            this.checkParameters(context, member.parameters ?? [], member);

            if ((member.parameters ?? []).length !== 1) {
                const message =
                    `index signature in interface ${Helpers.RED}'${contextName}'${Helpers.RESET} must have exactly one parameter`;

                member.arrowLength = member.raw?.length ?? 1;

                this.throwError(
                    message,
                    member.position,
                    context.raw ?? context.source,
                    member,
                );
            }
        }

        public checkParameters(context: any, parameters: any[], owner: any): void {
            const names = new Set<string>();

            for (const parameter of parameters) {
                const parameterName = this.getNameText(parameter.name);

                if (parameterName && parameterName !== "this") {
                    if (names.has(parameterName)) {
                        const message =
                            `parameter ${Helpers.RED}'${parameterName}'${Helpers.RESET} is defined multiple times`;

                        parameter.arrowLength =
                            parameter.raw?.length ?? parameterName.length;

                        this.throwError(
                            message,
                            parameter.position ?? owner.position,
                            context.raw ?? context.source,
                            parameter,
                        );
                    }

                    names.add(parameterName);
                }

                if (!parameter.type || parameter.type.kind === Kinds.Types.UnTyped) {
                    const message =
                        `parameter ${Helpers.RED}'${parameterName}'${Helpers.RESET} is missing a type annotation`;

                    parameter.arrowLength =
                        parameter.raw?.length ?? parameterName?.length ?? 1;

                    this.throwError(
                        message,
                        parameter.position ?? owner.position,
                        context.raw ?? context.source,
                        parameter,
                    );
                }
            }
        }

        public mergeInterfaceDeclaration(
            node: any,
            symbol: any,
            newMembers: any[],
        ): any[] {
            const existingNode = symbol.node;
            const existingMembers = existingNode.type?.members ?? [];
            const interfaceName = this.getNameText(node.name);

            this.checkInterfaceMergeCompatibility(node, symbol);

            for (const member of newMembers) {
                const memberName = this.getMemberNameText(member);

                if (!memberName) {
                    continue;
                }

                const duplicated = existingMembers.find(
                    (existing: any) =>
                        this.getMemberNameText(existing) === memberName &&
                        this.isNonOverloadMember(member) &&
                        this.isNonOverloadMember(existing),
                );

                if (duplicated && !this.areMembersCompatible(duplicated, member)) {
                    const message =
                        `member ${Helpers.RED}'${memberName}'${Helpers.RESET} is already declared with incompatible type in interface ` +
                        `${Helpers.RED}'${interfaceName}'${Helpers.RESET}`;

                    member.arrowLength = member.raw?.length ?? memberName.length;

                    this.throwError(
                        message,
                        member.position,
                        node.raw ?? node.source,
                        member,
                    );
                }
            }

            const declarationInfo = this.getDeclarationInfo(node, newMembers);
            const mergedMembers = [...existingMembers, ...newMembers];

            existingNode.type = {
                ...existingNode.type,
                members: mergedMembers,
            };

            existingNode.body = existingNode.type;

            existingNode.merged = true;
            existingNode.declarations = [
                ...(existingNode.declarations ?? []),
                declarationInfo,
            ];

            symbol.type = existingNode.type;
            symbol.node = existingNode;

            return [];
        }

        public checkInterfaceMergeCompatibility(node: any, symbol: any): void {
            const existingNode = symbol.node;

            if (!existingNode) return;

            const currentName = this.getNameText(node.name);
            const currentParameters = node.parameters ?? node.typeParameters ?? [];
            const existingParameters =
                existingNode.parameters ?? existingNode.typeParameters ?? [];

            if (currentParameters.length !== existingParameters.length) {
                const message =
                    `interface ${Helpers.RED}'${currentName}'${Helpers.RESET} declarations must have the same number of type parameters`;

                node.arrowLength = currentName.length;

                this.throwError(
                    message,
                    this.getNamePosition(node.name) ?? node.position,
                    node.raw ?? node.source,
                    node,
                );
            }

            for (let i = 0; i < currentParameters.length; i++) {
                const current = currentParameters[i];
                const existing = existingParameters[i];

                const currentConstraint = this.getTypeRaw(current.constraint);
                const existingConstraint = this.getTypeRaw(existing.constraint);

                if (currentConstraint !== existingConstraint) {
                    const message =
                        `type parameter constraint for ${Helpers.RED}'${currentName}'${Helpers.RESET} does not match previous declaration`;

                    current.arrowLength = current.raw?.length ?? 1;

                    this.throwError(
                        message,
                        current.position ?? node.position,
                        node.raw ?? node.source,
                        current,
                    );
                }

                const currentDefault = this.getTypeRaw(current.defaultType);
                const existingDefault = this.getTypeRaw(existing.defaultType);

                if (currentDefault !== existingDefault) {
                    const message =
                        `type parameter default for ${Helpers.RED}'${currentName}'${Helpers.RESET} does not match previous declaration`;

                    current.arrowLength = current.raw?.length ?? 1;

                    this.throwError(
                        message,
                        current.position ?? node.position,
                        node.raw ?? node.source,
                        current,
                    );
                }
            }
        }

        public checkTypeArguments(typeUsage: any, symbol: any): void {
            const typeArguments = typeUsage.arguments ?? typeUsage.typeArguments ?? [];
            const parameters =
                symbol.node?.parameters ?? symbol.node?.typeParameters ?? [];

            const requiredParameters = parameters.filter(
                (param: any) => !param.defaultType,
            );

            if (
                typeArguments.length < requiredParameters.length ||
                typeArguments.length > parameters.length
            ) {
                const name = this.getTypeUsageNameText(typeUsage);

                const message =
                    `type ${Helpers.RED}'${name}'${Helpers.RESET} expects ${parameters.length} type argument(s), ` +
                    `but got ${typeArguments.length}`;

                typeUsage.arrowLength = typeUsage.raw?.length ?? name.length;

                this.throwError(
                    message,
                    typeUsage.position,
                    typeUsage.raw,
                    typeUsage,
                );
            }
        }

        public canInterfaceExtendSymbol(symbol: any): boolean {
            if (!symbol) return false;

            if (symbol.kind === Kinds.ScopeSymbols.Interface) {
                return true;
            }

            if (symbol.kind === Kinds.ScopeSymbols.Class) {
                return true;
            }

            if (symbol.kind === Kinds.ScopeSymbols.Type) {
                const type = this.getSymbolTypeNode(symbol);
                return this.isInterfaceExtensibleType(type);
            }

            return false;
        }

        public getSymbolTypeNode(symbol: any): any {
            return (
                symbol.type ??
                symbol.node?.type ??
                symbol.node?.body ??
                symbol.node?.valueType ??
                null
            );
        }

        public isInterfaceExtensibleType(type: any): boolean {
            if (!type) return false;

            const kind = type.kind;

            if (kind === Kinds.Types.TypeLiteral || kind === "TypeLiteral") {
                return true;
            }

            if (
                kind === Kinds.Types.InterfaceDeclaration ||
                kind === "InterfaceDeclaration"
            ) {
                return true;
            }

            if (kind === Kinds.Types.IntersectionType || kind === "IntersectionType") {
                return (type.types ?? []).every((part: any) =>
                    this.isInterfaceExtensibleType(part),
                );
            }

            if (kind === Kinds.Types.TypeReference || kind === "TypeReference") {
                const name = this.getQualifiedNameText(type.name);
                const symbol = this.resolveSymbol(name);

                if (!symbol) return false;

                return this.canInterfaceExtendSymbol(symbol);
            }

            return false;
        }

        public getExtensibleMembersFromSymbol(symbol: any): any[] {
            if (!symbol) return [];

            if (symbol.kind === Kinds.ScopeSymbols.Interface) {
                return symbol.type?.members ?? symbol.node?.body?.members ?? [];
            }

            if (symbol.kind === Kinds.ScopeSymbols.Class) {
                return symbol.type?.members ?? symbol.node?.body?.members ?? [];
            }

            const type = this.getSymbolTypeNode(symbol);

            return this.getMembersFromExtensibleType(type);
        }

        public getMembersFromExtensibleType(type: any): any[] {
            if (!type) return [];

            const kind = type.kind;

            if (kind === Kinds.Types.TypeLiteral || kind === "TypeLiteral") {
                return type.members ?? [];
            }

            if (kind === Kinds.Types.IntersectionType || kind === "IntersectionType") {
                return (type.types ?? []).flatMap((part: any) =>
                    this.getMembersFromExtensibleType(part),
                );
            }

            if (kind === Kinds.Types.TypeReference || kind === "TypeReference") {
                const name = this.getQualifiedNameText(type.name);
                const symbol = this.resolveSymbol(name);

                if (!symbol) return [];

                return this.getExtensibleMembersFromSymbol(symbol);
            }

            return [];
        }

        public areMembersCompatible(a: any, b: any): boolean {
            if (!a || !b) return false;

            if (a.kind !== b.kind) {
                return false;
            }

            const aType = this.getTypeRaw(a.type ?? a.returnType);
            const bType = this.getTypeRaw(b.type ?? b.returnType);

            if (aType !== bType) {
                return false;
            }

            if ((a.optional ?? false) !== (b.optional ?? false)) {
                return false;
            }

            if ((a.readonly ?? false) !== (b.readonly ?? false)) {
                return false;
            }

            return true;
        }

        public getDeclarationInfo(node: any, members: any[] = []): any {
            return {
                kind: node.kind,
                name: node.name,
                nameText: this.getNameText(node.name),
                parameters: node.parameters ?? node.typeParameters ?? [],
                extends: node.extends ?? [],
                raw: node.raw ?? node.source,
                position: node.position,
                members: members.map((member: any) => ({
                    kind: member.kind,
                    name: member.name,
                    nameText: this.getMemberNameText(member),
                    typeParameters: member.typeParameters ?? [],
                    optional: member.optional ?? false,
                    readonly: member.readonly ?? false,
                    type: member.type,
                    returnType: member.returnType,
                    parameters: member.parameters ?? [],
                    raw: member.raw,
                    position: member.position,
                    trusted: member.trusted ?? true,
                })),
            };
        }

        public getTypeBody(node: any): any {
            return node.body ?? node.type;
        }

        public isTypeLiteral(type: any): boolean {
            return (
                type?.kind === Kinds.Types.TypeLiteral ||
                type?.kind === "TypeLiteral"
            );
        }

        public getNameText(name: any): string {
            if (!name) return "";

            if (typeof name === "string") {
                return name;
            }

            if (typeof name.name === "string") {
                return name.name;
            }

            if (typeof name.value === "string") {
                return name.value;
            }

            if (typeof name.raw === "string") {
                return name.raw;
            }

            return String(name);
        }

        public getNamePosition(name: any): any {
            if (!name) return null;

            if (typeof name === "object" && name.position) {
                return name.position;
            }

            return null;
        }

        public getTypeUsageNameText(typeUsage: any): string {
            if (!typeUsage) return "";

            if (typeUsage.name) {
                return this.getQualifiedNameText(typeUsage.name);
            }

            if (typeUsage.expression) {
                return this.getQualifiedNameText(typeUsage.expression);
            }

            return this.getNameText(typeUsage);
        }

        public getQualifiedNameText(name: any): string {
            if (!name) return "";

            if (typeof name === "string") {
                return name;
            }

            if (Array.isArray(name.parts)) {
                return name.parts.map((part: any) => this.getNameText(part)).join(".");
            }

            return this.getNameText(name);
        }

        public getMemberNameText(member: any): string | null {
            if (!member) return null;

            const kind = member.kind;

            const isCall =
                kind === Kinds.Types.CallSignature ||
                kind === "CallSignature";

            const isConstruct =
                kind === Kinds.Types.ConstructSignature ||
                kind === "ConstructSignature";

            const isIndex =
                kind === Kinds.Types.IndexSignature ||
                kind === "IndexSignature";

            if (isCall || isConstruct || isIndex) {
                return null;
            }

            return this.getNameText(member.name);
        }

        public isOverloadMember(member: any): boolean {
            const kind = member.kind;

            return (
                kind === Kinds.Types.MethodSignature ||
                kind === "MethodSignature" ||
                kind === Kinds.Types.CallSignature ||
                kind === "CallSignature" ||
                kind === Kinds.Types.ConstructSignature ||
                kind === "ConstructSignature"
            );
        }

        public isNonOverloadMember(member: any): boolean {
            const kind = member.kind;

            return !(
                kind === Kinds.Types.MethodSignature ||
                kind === "MethodSignature" ||
                kind === Kinds.Types.CallSignature ||
                kind === "CallSignature" ||
                kind === Kinds.Types.ConstructSignature ||
                kind === "ConstructSignature"
            );
        }

        public getTypeRaw(type: any): string | null {
            if (!type) return null;

            if (typeof type.raw === "string") {
                return type.raw;
            }

            if (typeof type.kind === "string") {
                return type.kind;
            }

            return JSON.stringify(type);
        }
    };
}
