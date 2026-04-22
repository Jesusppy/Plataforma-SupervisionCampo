"""add user ownership to projects and templates"""

revision = '0f4c8a6d4d5b'
down_revision = '33fa85137dfe'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def _select_owner_id(connection):
    owner_id = connection.execute(
        sa.text(
            "SELECT id FROM users WHERE is_superuser = true ORDER BY created_at ASC LIMIT 1"
        )
    ).scalar()
    if owner_id is not None:
        return owner_id

    return connection.execute(
        sa.text("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")
    ).scalar()


def upgrade() -> None:
    connection = op.get_bind()

    op.add_column('projects', sa.Column('user_id', sa.UUID(), nullable=True))
    op.add_column('templates', sa.Column('user_id', sa.UUID(), nullable=True))

    op.create_foreign_key(
        'fk_projects_user_id_users',
        'projects',
        'users',
        ['user_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_foreign_key(
        'fk_templates_user_id_users',
        'templates',
        'users',
        ['user_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_index(op.f('ix_projects_user_id'), 'projects', ['user_id'], unique=False)
    op.create_index(op.f('ix_templates_user_id'), 'templates', ['user_id'], unique=False)

    owner_id = _select_owner_id(connection)
    project_count = connection.execute(sa.text('SELECT COUNT(*) FROM projects')).scalar() or 0
    template_count = connection.execute(sa.text('SELECT COUNT(*) FROM templates')).scalar() or 0

    if owner_id is None and (project_count or template_count):
        raise RuntimeError(
            'No existing user is available to backfill project/template ownership.'
        )

    if owner_id is not None:
        connection.execute(
            sa.text('UPDATE projects SET user_id = :owner_id WHERE user_id IS NULL'),
            {'owner_id': owner_id},
        )
        connection.execute(
            sa.text('UPDATE templates SET user_id = :owner_id WHERE user_id IS NULL'),
            {'owner_id': owner_id},
        )

    op.alter_column('projects', 'user_id', nullable=False)
    op.alter_column('templates', 'user_id', nullable=False)

    op.drop_index(op.f('ix_templates_name'), table_name='templates')
    op.create_index(op.f('ix_templates_name'), 'templates', ['name'], unique=False)
    op.create_unique_constraint(
        'uq_templates_user_id_name',
        'templates',
        ['user_id', 'name'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_templates_user_id_name', 'templates', type_='unique')
    op.drop_index(op.f('ix_templates_name'), table_name='templates')
    op.create_index(op.f('ix_templates_name'), 'templates', ['name'], unique=True)

    op.drop_index(op.f('ix_templates_user_id'), table_name='templates')
    op.drop_index(op.f('ix_projects_user_id'), table_name='projects')
    op.drop_constraint('fk_templates_user_id_users', 'templates', type_='foreignkey')
    op.drop_constraint('fk_projects_user_id_users', 'projects', type_='foreignkey')
    op.drop_column('templates', 'user_id')
    op.drop_column('projects', 'user_id')