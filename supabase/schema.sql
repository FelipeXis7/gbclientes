create extension if not exists "pgcrypto";

create table if not exists public.gb_estado_app (
    id text primary key default 'principal',
    dados jsonb not null default '{}'::jsonb,
    atualizado_em timestamptz not null default now()
);

create table if not exists public.gb_barbeiros (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    telefone text,
    cpf text,
    ativo boolean not null default true,
    expediente boolean not null default false,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create table if not exists public.gb_clientes (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    telefone text not null,
    email text,
    data_nascimento date,
    plano_status text not null default 'sem_plano',
    plano_vence_em date,
    ativo boolean not null default true,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create table if not exists public.gb_produtos_servicos (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    categoria text not null check (categoria in ('servico_avulso', 'produto', 'plano_club')),
    codigo text unique,
    valor numeric(10,2) not null default 0,
    ativo boolean not null default true,
    divide_combo boolean not null default false,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create table if not exists public.gb_assinaturas (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid references public.gb_clientes(id) on delete set null,
    plano_id uuid references public.gb_produtos_servicos(id) on delete set null,
    status text not null default 'ativa',
    valor numeric(10,2) not null default 0,
    pagamento_gateway text,
    pagamento_referencia text,
    inicio_em date not null default current_date,
    vence_em date,
    cancelado_em timestamptz,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create table if not exists public.gb_fila (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid references public.gb_clientes(id) on delete set null,
    barbeiro_id uuid references public.gb_barbeiros(id) on delete set null,
    status text not null default 'aguardando',
    criado_em timestamptz not null default now(),
    inicio_em timestamptz,
    finalizado_em timestamptz
);

create table if not exists public.gb_atendimentos (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid references public.gb_clientes(id) on delete set null,
    barbeiro_id uuid references public.gb_barbeiros(id) on delete set null,
    servico_id uuid references public.gb_produtos_servicos(id) on delete set null,
    valor_cobrado numeric(10,2) not null default 0,
    origem text not null default 'balcao',
    observacao text,
    iniciado_em timestamptz,
    finalizado_em timestamptz not null default now(),
    criado_em timestamptz not null default now()
);

create table if not exists public.gb_expedientes (
    id uuid primary key default gen_random_uuid(),
    data date not null default current_date,
    aberto_em timestamptz not null default now(),
    fechado_em timestamptz,
    servicos_por_hora numeric(6,2) not null default 3,
    barbeiros_ativos integer not null default 0,
    capacidade_calculada numeric(10,2) not null default 0,
    observacao text,
    criado_em timestamptz not null default now()
);

create table if not exists public.gb_expediente_barbeiros (
    expediente_id uuid references public.gb_expedientes(id) on delete cascade,
    barbeiro_id uuid references public.gb_barbeiros(id) on delete cascade,
    ativo boolean not null default true,
    primary key (expediente_id, barbeiro_id)
);

create table if not exists public.gb_avaliacoes (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid references public.gb_clientes(id) on delete set null,
    nome text not null,
    telefone text,
    estrelas integer not null default 5 check (estrelas between 1 and 5),
    texto text not null,
    aprovado boolean not null default true,
    criado_em timestamptz not null default now()
);

create table if not exists public.gb_fechamentos_mensais (
    id uuid primary key default gen_random_uuid(),
    referencia_mes date not null unique,
    faturamento_club numeric(12,2) not null default 0,
    percentual_loja numeric(5,2) not null default 50,
    percentual_barbeiros numeric(5,2) not null default 50,
    valor_rateio_barbeiros numeric(12,2) not null default 0,
    total_fichas numeric(12,2) not null default 0,
    valor_ficha numeric(12,6) not null default 0,
    total_servicos integer not null default 0,
    total_servicos_distribuidos integer not null default 0,
    recorrencia numeric(12,6) not null default 0,
    ticket_medio numeric(12,2) not null default 0,
    capacidade_total numeric(12,2) not null default 0,
    taxa_ocupacao numeric(8,4) not null default 0,
    status text not null default 'rascunho',
    criado_em timestamptz not null default now(),
    fechado_em timestamptz
);

create table if not exists public.gb_fechamento_barbeiros (
    id uuid primary key default gen_random_uuid(),
    fechamento_id uuid references public.gb_fechamentos_mensais(id) on delete cascade,
    barbeiro_id uuid references public.gb_barbeiros(id) on delete set null,
    quantidade_corte integer not null default 0,
    quantidade_barba integer not null default 0,
    quantidade_combo integer not null default 0,
    quantidade_pezinho integer not null default 0,
    total_servicos integer not null default 0,
    total_fichas numeric(12,2) not null default 0,
    participacao numeric(8,4) not null default 0,
    ocupacao numeric(8,4) not null default 0,
    comissao numeric(12,2) not null default 0
);

create table if not exists public.gb_acessos (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    login text not null unique,
    perfil text not null default 'barbeiro',
    ativo boolean not null default true,
    senha_hash text,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

insert into public.gb_produtos_servicos (nome, categoria, codigo, valor, divide_combo)
values
    ('Corte avulso', 'servico_avulso', 'corte', 25.00, false),
    ('Barba avulsa', 'servico_avulso', 'barba', 20.00, false),
    ('Combo avulso', 'servico_avulso', 'combo', 45.00, true),
    ('Pezinho', 'servico_avulso', 'pezinho', 5.00, false),
    ('Goiano''s Club Corte', 'plano_club', 'club_corte', 54.90, false),
    ('Goiano''s Club Barba', 'plano_club', 'club_barba', 54.90, false),
    ('Goiano''s Club Combo', 'plano_club', 'club_combo', 99.90, true)
on conflict (codigo) do update set
    nome = excluded.nome,
    categoria = excluded.categoria,
    valor = excluded.valor,
    divide_combo = excluded.divide_combo,
    atualizado_em = now();

alter table public.gb_estado_app enable row level security;
alter table public.gb_barbeiros enable row level security;
alter table public.gb_clientes enable row level security;
alter table public.gb_produtos_servicos enable row level security;
alter table public.gb_assinaturas enable row level security;
alter table public.gb_fila enable row level security;
alter table public.gb_atendimentos enable row level security;
alter table public.gb_expedientes enable row level security;
alter table public.gb_expediente_barbeiros enable row level security;
alter table public.gb_avaliacoes enable row level security;
alter table public.gb_fechamentos_mensais enable row level security;
alter table public.gb_fechamento_barbeiros enable row level security;
alter table public.gb_acessos enable row level security;

drop policy if exists "teste_estado_app_ler" on public.gb_estado_app;
drop policy if exists "teste_estado_app_salvar" on public.gb_estado_app;

create policy "teste_estado_app_ler"
on public.gb_estado_app
for select
to anon, authenticated
using (true);

create policy "teste_estado_app_salvar"
on public.gb_estado_app
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "site_ler_produtos" on public.gb_produtos_servicos;
drop policy if exists "site_ler_avaliacoes" on public.gb_avaliacoes;

create policy "site_ler_produtos"
on public.gb_produtos_servicos
for select
to anon, authenticated
using (ativo = true);

create policy "site_ler_avaliacoes"
on public.gb_avaliacoes
for select
to anon, authenticated
using (aprovado = true);
