

export type Constructor<T = {}> = new (...args: any[]) => T;
export type Mixin<T extends Constructor> = <TBase extends Constructor>(Base: TBase) => T & TBase;
export type MixinFlatBuffer = (base: any) => any;

export function applyFlatBufferMixins<TBase extends Constructor>(Base: TBase, ...mixins: MixinFlatBuffer[]): TBase | any {
    return mixins.reduce((current, mixin) => mixin(current), Base);
}


export class BaseFlatBuffer {

}
