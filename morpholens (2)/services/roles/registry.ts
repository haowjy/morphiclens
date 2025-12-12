
import { Role } from './types';
import { roleLoader } from './loader';
import { db } from '../../lib/db';
import { BIOMEDICAL_ROLE, GENERIC_ROLE, SKILL_ARCHITECT_ROLE } from './builtins';

class RoleRegistry {
  private roles: Map<string, Role> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Built-ins
    this.roles.set(BIOMEDICAL_ROLE.manifest.id, BIOMEDICAL_ROLE);
    this.roles.set(GENERIC_ROLE.manifest.id, GENERIC_ROLE);
    this.roles.set(SKILL_ARCHITECT_ROLE.manifest.id, SKILL_ARCHITECT_ROLE);

    // Stored
    try {
        const storedRoles = await db.roles.toArray();
        for (const stored of storedRoles) {
            try {
                const file = new File([stored.roleData], `${stored.id}.role`);
                const role = await roleLoader.loadFromFile(file);
                this.roles.set(role.manifest.id, role);
            } catch (error) {
                console.error(`Failed to load stored role: ${stored.id}`, error);
            }
        }
    } catch (e) {
        // DB might not be ready if called too early, but usually init happens after hydration
        console.warn("Could not load stored roles from DB", e);
    }

    this.initialized = true;
  }

  getRole(id: string): Role {
    const role = this.roles.get(id);
    if (!role) {
      // Fallback
      if (id === 'biomedical') return BIOMEDICAL_ROLE;
      if (id === 'generic') return GENERIC_ROLE;
      if (id === 'role_architect' || id === 'skill_architect') return SKILL_ARCHITECT_ROLE;
      throw new Error(`Role not found: ${id}`);
    }
    return role;
  }

  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  async registerRole(role: Role, roleData: Blob): Promise<void> {
    if (!role.isBuiltIn) {
      await db.roles.put({
        id: role.manifest.id,
        roleData,
        loadedAt: Date.now(),
      });
    }
    this.roles.set(role.manifest.id, role);
  }

  async deleteRole(id: string): Promise<void> {
    const role = this.roles.get(id);
    if (!role) return;
    if (role.isBuiltIn) throw new Error('Cannot delete built-in roles');
    
    await db.roles.delete(id);
    this.roles.delete(id);
  }

  getDefaultRoleId(): string {
    return 'generic';
  }
}

export const roleRegistry = new RoleRegistry();
