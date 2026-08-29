import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initTestDb,
  closeTestDb,
  resetTestDb,
  createTestUser,
  createTestRole,
} from '../../../../test/db';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeAll(async () => {
    await initTestDb();
    service = new UsersService();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('crea con la contraseña hasheada (nunca en claro)', async () => {
      const user = await service.create({
        username: ' cajero1 ',
        name: ' Cajera Uno ',
        password: 'clave-secreta',
        role: 'employee',
      });
      expect(user.username).toBe('cajero1');
      expect(user.name).toBe('Cajera Uno');
      expect(user.password).not.toBe('clave-secreta');
      expect(user.password).toMatch(/^\$2/); // hash bcrypt
      expect(await service.verifyCredentials('cajero1', 'clave-secreta')).toBeTruthy();
    });

    it('rechaza campos faltantes, rol inválido y username duplicado', async () => {
      await expect(service.create({ username: 'x', name: 'X' })).rejects.toThrow(/Faltan campos/);
      await expect(
        service.create({ username: 'x', name: 'X', password: 'p', role: 'superadmin' as never }),
      ).rejects.toThrow(/Rol inválido/);
      await service.create({ username: 'dup', name: 'Uno', password: 'p1' });
      await expect(service.create({ username: 'dup', name: 'Dos', password: 'p2' })).rejects.toThrow(
        /ya existe/,
      );
    });

    it('ignora campos no whitelisted como session_token', async () => {
      const user = await service.create({
        username: 'seguro',
        name: 'Seguro',
        password: 'p',
        session_token: 'token-forzado',
      } as never);
      expect(user.session_token ?? null).toBeNull();
    });
  });

  // ─── verifyCredentials ──────────────────────────────────────────────────────

  describe('verifyCredentials', () => {
    it('credenciales correctas devuelven el usuario; incorrectas null', async () => {
      const user = await createTestUser(); // password 'secret123'
      expect((await service.verifyCredentials(user.username, 'secret123'))?.id).toBe(user.id);
      expect(await service.verifyCredentials(user.username, 'incorrecta')).toBeNull();
      expect(await service.verifyCredentials('no-existe', 'secret123')).toBeNull();
    });
  });

  // ─── toSafeUser / findAll ───────────────────────────────────────────────────

  describe('saneado', () => {
    it('toSafeUser elimina password y session_token', async () => {
      const user = await createTestUser({ session_token: 'abc123' });
      const safe = UsersService.toSafeUser(user);
      expect((safe as never)['password']).toBeUndefined();
      expect((safe as never)['session_token']).toBeUndefined();
      expect(safe.id).toBe(user.id);
      expect(safe.username).toBe(user.username);
    });

    it('findAll devuelve usuarios sin secretos', async () => {
      await createTestUser();
      await createTestUser();
      const users = await service.findAll();
      expect(users).toHaveLength(2);
      for (const u of users) {
        expect((u as never)['password']).toBeUndefined();
        expect((u as never)['session_token']).toBeUndefined();
      }
    });
  });

  // ─── listLoginProfiles ──────────────────────────────────────────────────────

  describe('listLoginProfiles', () => {
    it('devuelve SOLO id/name/username/roleLabel, ordenado por nombre', async () => {
      const role = await createTestRole({ name: 'Cajero Nocturno' });
      await createTestUser({ name: 'Beto', role: 'employee', role_id: role.id });
      await createTestUser({ name: 'Ana', role: 'admin' }); // sin role_entity → label legacy
      await createTestUser({ name: 'Caro', role: 'employee' });

      const profiles = await service.listLoginProfiles();
      expect(profiles.map(p => p.name)).toEqual(['Ana', 'Beto', 'Caro']);
      for (const p of profiles) {
        expect(Object.keys(p).sort()).toEqual(['id', 'name', 'roleLabel', 'username']);
      }
      expect(profiles[0].roleLabel).toBe('Administrador');
      expect(profiles[1].roleLabel).toBe('Cajero Nocturno');
      expect(profiles[2].roleLabel).toBe('Empleado');
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('contraseña vacía conserva la anterior; no vacía la reemplaza', async () => {
      const user = await createTestUser(); // password 'secret123'
      await service.update(user.id, { password: '' });
      expect(await service.verifyCredentials(user.username, 'secret123')).toBeTruthy();

      await service.update(user.id, { password: 'nueva-clave' });
      expect(await service.verifyCredentials(user.username, 'secret123')).toBeNull();
      expect(await service.verifyCredentials(user.username, 'nueva-clave')).toBeTruthy();
    });

    it('valida nombre/username vacíos y username duplicado', async () => {
      const user = await createTestUser();
      const other = await createTestUser();
      await expect(service.update(user.id, { name: '  ' })).rejects.toThrow(/no puede estar vacío/);
      await expect(service.update(user.id, { username: '' })).rejects.toThrow(/no puede estar vacío/);
      await expect(service.update(user.id, { username: other.username })).rejects.toThrow(/ya existe/);
      // conservar su propio username no es duplicado
      await expect(service.update(user.id, { username: user.username })).resolves.toBeTruthy();
    });

    it('no permite cambiar tu propio rol (legacy ni role_id)', async () => {
      const admin = await createTestUser({ role: 'admin' });
      await expect(service.update(admin.id, { role: 'employee' }, admin.id)).rejects.toThrow(
        /No puedes cambiar tu propio rol/,
      );
      const role = await createTestRole();
      await expect(service.update(admin.id, { role_id: role.id }, admin.id)).rejects.toThrow(
        /No puedes cambiar tu propio rol/,
      );
      // reenviar el mismo rol sí pasa
      await expect(service.update(admin.id, { role: 'admin' }, admin.id)).resolves.toBeTruthy();
    });

    it('otro admin sí puede cambiar el rol y el role_id', async () => {
      const actor = await createTestUser({ role: 'admin' });
      const target = await createTestUser({ role: 'employee' });
      const role = await createTestRole({ name: 'Supervisor' });

      const updated = await service.update(target.id, { role: 'admin', role_id: role.id }, actor.id);
      expect(updated.role).toBe('admin');
      expect(updated.role_id).toBe(role.id);
    });

    it('rechaza rol/role_id inválidos y usuario inexistente', async () => {
      const user = await createTestUser();
      await expect(service.update(user.id, { role: 'root' as never })).rejects.toThrow(/Rol inválido/);
      await expect(service.update(user.id, { role_id: '' })).rejects.toThrow(/Rol inválido/);
      await expect(service.update('ghost', { name: 'X' })).rejects.toThrow(/no encontrado/);
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('no permite eliminarse a sí mismo', async () => {
      const admin = await createTestUser({ role: 'admin' });
      await expect(service.delete(admin.id, admin.id)).rejects.toThrow(/tu propio usuario/);
    });

    it('no permite eliminar al último admin', async () => {
      const admin = await createTestUser({ role: 'admin' });
      const actor = await createTestUser({ role: 'employee' });
      await expect(service.delete(admin.id, actor.id)).rejects.toThrow(/último administrador/);
    });

    it('con dos admins sí se puede eliminar uno; empleados siempre', async () => {
      const admin1 = await createTestUser({ role: 'admin' });
      const admin2 = await createTestUser({ role: 'admin' });
      const employee = await createTestUser({ role: 'employee' });

      await service.delete(admin2.id, admin1.id);
      expect(await service.findOne(admin2.id)).toBeNull();

      await service.delete(employee.id, admin1.id);
      expect(await service.findOne(employee.id)).toBeNull();
    });

    it('usuario inexistente lanza', async () => {
      const admin = await createTestUser({ role: 'admin' });
      await expect(service.delete('ghost', admin.id)).rejects.toThrow(/no encontrado/);
    });
  });

  // ─── Session tokens ─────────────────────────────────────────────────────────

  describe('tokens de sesión', () => {
    it('issueSessionToken devuelve el token en claro y guarda solo el hash', async () => {
      const user = await createTestUser();
      const token = await service.issueSessionToken(user.id);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      const stored = await service.findOne(user.id);
      expect(stored!.session_token).not.toBe(token);
      expect(stored!.session_token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('verifySessionToken: token bueno true, malo false, usuario sin token false', async () => {
      const user = await createTestUser();
      const token = await service.issueSessionToken(user.id);
      expect(await service.verifySessionToken(user.id, token)).toBe(true);
      expect(await service.verifySessionToken(user.id, 'a'.repeat(64))).toBe(false);
      expect(await service.verifySessionToken(user.id, 'basura')).toBe(false);

      const fresh = await createTestUser();
      expect(await service.verifySessionToken(fresh.id, token)).toBe(false);
      expect(await service.verifySessionToken('ghost', token)).toBe(false);
    });

    it('emitir un token nuevo invalida el anterior', async () => {
      const user = await createTestUser();
      const first = await service.issueSessionToken(user.id);
      const second = await service.issueSessionToken(user.id);
      expect(first).not.toBe(second);
      expect(await service.verifySessionToken(user.id, first)).toBe(false);
      expect(await service.verifySessionToken(user.id, second)).toBe(true);
    });

    it('clearSessionToken invalida el token', async () => {
      const user = await createTestUser();
      const token = await service.issueSessionToken(user.id);
      await service.clearSessionToken(user.id);
      expect(await service.verifySessionToken(user.id, token)).toBe(false);
      expect((await service.findOne(user.id))!.session_token).toBeNull();
    });
  });

  // ─── checkOnboardingStatus ──────────────────────────────────────────────────

  describe('checkOnboardingStatus', () => {
    it('completed solo cuando existe al menos un admin', async () => {
      expect((await service.checkOnboardingStatus()).completed).toBe(false);
      await createTestUser({ role: 'employee' });
      expect((await service.checkOnboardingStatus()).completed).toBe(false);
      await createTestUser({ role: 'admin' });
      expect((await service.checkOnboardingStatus()).completed).toBe(true);
    });
  });
});
