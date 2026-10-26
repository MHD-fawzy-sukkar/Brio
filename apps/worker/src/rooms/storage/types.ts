export interface SqlStorageLike {
  exec(query: string, ...bindings: any[]): any;
}
