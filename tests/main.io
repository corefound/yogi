type Entity = {
    id: number;
};

interface User extends Entity, Entity {
    name: string;
}