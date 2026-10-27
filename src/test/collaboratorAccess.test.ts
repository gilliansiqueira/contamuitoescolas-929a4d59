import { describe, it, expect } from 'vitest';
import { canManageCollaborator, canCreateCollaborator } from '../../supabase/functions/_shared/collaboratorAccess';

describe('gestão delegada de colaboradores', () => {
  it('permite que Isabelly crie colaboradores com a permissão específica', () => {
    expect(canCreateCollaborator(['admin'], ['collaborators_manage'])).toBe(true);
    expect(canCreateCollaborator(['admin'], [])).toBe(false);
  });
  it('permite editar qualquer colaborador, inclusive o próprio cadastro', () => {
    expect(canManageCollaborator(['admin'], ['collaborators_manage'], ['admin'])).toBe(true);
  });
  it('não permite administrar ou assumir o acesso de proprietária', () => {
    expect(canManageCollaborator(['admin'], ['collaborators_manage'], ['admin', 'super_admin'])).toBe(false);
    expect(canManageCollaborator(['admin'], ['collaborators_manage'], ['super_admin'])).toBe(false);
  });
  it('não libera a mesma gestão para clientes ou colaboradores sem permissão', () => {
    expect(canManageCollaborator(['cliente'], ['collaborators_manage'], ['admin'])).toBe(false);
    expect(canManageCollaborator(['admin'], [], ['admin'])).toBe(false);
    expect(canManageCollaborator(['admin'], ['collaborators_manage'], ['cliente'])).toBe(false);
  });
});