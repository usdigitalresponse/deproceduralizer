import { Database } from '../client';

export abstract class BaseRepository {
  constructor(protected db: Database) {}
}
