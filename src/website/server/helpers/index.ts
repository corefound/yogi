import { GraphQLResolveInfo, FieldNode } from 'graphql';

const getGqlBody = (fieldNodes: any[], schema: string) => {
    let body: any = {
        [schema]: []
    }

    const gqlSchemas = [
        "user",
        "users",
        "packages",
        "package",
        "versions",
        "version",
        "installations",
        "installation"
    ];

    fieldNodes?.forEach((item: any) => {
        if (item.kind === 'Field') {
            if (!gqlSchemas.includes(item.name.value)) {
                if (item.name.value !== "__typename") {
                    body[schema].push(item.name.value)
                }
            } else {
                const items = getGqlBody(item.selectionSet?.selections, item.name.value)
                body = Object.assign(body, items)
            }
        }
    })

    return body
}

export const getQueryResponseFields = (fieldNodes: readonly any[], name: string) => {
    const selections = fieldNodes[0].selectionSet?.selections;
    const fields = getGqlBody(selections, name)

    return fields
}
