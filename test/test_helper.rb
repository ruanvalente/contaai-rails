ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require "capybara/rails"
require "capybara/minitest"

# O auto-load de schema em test está desativado (config/environments/test.rb), então o
# banco de test precisa estar migrado antes de rodar a suíte. Falhe cedo com mensagem
# clara em vez de testar contra um schema desatualizado.
begin
  if ActiveRecord::Base.connection_pool.migration_context.needs_migration?
    abort <<~MSG
      Banco de test com migrations pendentes. Configure-o com:
        RAILS_ENV=test bin/rails runner 'ActiveRecord::Tasks::DatabaseTasks.migrate(skip_initialize: true)'
    MSG
  end
rescue ActiveRecord::NoDatabaseError, ActiveRecord::StatementInvalid
  abort <<~MSG
    Banco de test indisponível ou não configurado. Configure-o com:
      RAILS_ENV=test bin/rails db:create
      RAILS_ENV=test bin/rails runner 'ActiveRecord::Tasks::DatabaseTasks.migrate(skip_initialize: true)'
  MSG
end

# O Postgres gerenciado (Supabase local) não concede superuser ao role `postgres`, então:
# 1. Rails não consegue rodar `ALTER TABLE ... DISABLE TRIGGER` para limpar fixtures;
# 2. Rails não consegue executar `check_all_foreign_keys_valid!` (VALIDA CONSTRAINT exige
#    privilégio em pg_constraint).
# `TRUNCATE ... CASCADE` exige apenas ownership das tabelas e cumpre o mesmo papel.
ActiveRecord.verify_foreign_keys_for_fixtures = false
module ContaaiRails::TestFixtures
  module TruncateInsteadOfTriggerDisable
    def insert_fixtures_set(fixture_set, tables_to_delete = [])
      if tables_to_delete.any?
        tables = tables_to_delete.map { |table| quote_table_name(table) }
        execute("TRUNCATE TABLE #{tables.join(", ")} CASCADE")
      end

      ordered_fixture_set = fixture_set.sort_by { |table, _| fixture_fk_depth(table) }.to_h
      fixture_inserts = build_fixture_statements(ordered_fixture_set)
      transaction(requires_new: true) do
        execute_batch(fixture_inserts, "Fixtures Load")
      end
    end

    # Sem a possibilidade de desabilitar triggers, os INSERTs de fixture precisam
    # respeitar as dependências de chave estrangeira (pais antes de filhos).
    def fixture_fk_depth(table)
      @fixture_fk_depths ||= begin
        tables = ActiveRecord::Base.connection.data_sources
        fks = tables.to_h { |t| [ t, foreign_keys(t).map(&:to_table) ] }
        depths = tables.to_h { |t| [ t, 0 ] }

        # O grafo de dependências é normalmente acíclico; o limite de iterações
        # garante que um ciclo (ou self-FK) não vire loop infinito: profundidade
        # máxima em um grafo acíclico com N tabelas é N-1 passos.
        tables.length.times do
          changed = false
          tables.each do |t|
            parents = fks.fetch(t, []).select { |p| depths.key?(p) }
            next if parents.empty?

            candidate = parents.map { |p| depths[p] }.max + 1
            if candidate > depths[t]
              depths[t] = candidate
              changed = true
            end
          end
          break unless changed
        end

        depths
      end
      @fixture_fk_depths.fetch(table, 0)
    end
  end
end

ActiveSupport.on_load(:active_record) do
  ActiveRecord::ConnectionAdapters::PostgreSQLAdapter.prepend(ContaaiRails::TestFixtures::TruncateInsteadOfTriggerDisable)
end

module ActiveSupport
  class TestCase
    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # Add more helper methods to be used by all tests here...
  end
end

class ActionDispatch::IntegrationTest
  # Sign in/out helpers for Devise (https://github.com/heartcombo/devise#integration-tests)
  include Devise::Test::IntegrationHelpers
end
