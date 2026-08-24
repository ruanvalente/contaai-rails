# frozen_string_literal: true

require "application_system_test_case"
require "tmpdir"
require "fileutils"

class BookImportFlowTest < ApplicationSystemTestCase
  setup do
    @author = users(:author)
    @book = books(:draft_book)
    @upload_dir = Dir.mktmpdir
  end

  teardown do
    FileUtils.remove_entry(@upload_dir) if @upload_dir && File.exist?(@upload_dir)
  end

  test "complete flow: upload, review, edit, reorder, remove, add and confirm" do
    login_as @author
    visit write_book_path(@book)

    click_on "Importar"

    assert_text "Formatos aceitos"

    attach_file("Arquivo de texto", sample_file)
    click_on "Analisar arquivo"

    assert_text "2 capítulos encontrados"

    rows = all("[data-import-preview-target='row']")
    within rows.last do
      fill_in "Título do capítulo", with: "A descoberta revisada"
    end

    within rows.last do
      find("[aria-label='Mover capítulo para cima']").click
    end

    titles = all("input[name$='[title]']").map(&:value)
    assert_equal "A descoberta revisada", titles.first
    contents = all("textarea[name$='[content]']").map(&:value)
    assert_equal "João caminhou entre as árvores.", contents.first

    within all("[data-import-preview-target='row']").last do
      find("[aria-label='Remover capítulo da importação']").click
    end
    assert_text "1 capítulo"

    click_on "+ Adicionar capítulo em branco"
    assert_text "2 capítulos"

    chapters_before = @book.chapters.count

    click_on "Confirmar importação"

    assert_selector "h1", text: "Livro Rascunho"
    assert_text "A descoberta revisada"

    assert_equal chapters_before + 1, @book.chapters.count,
                 "linha adicionada em branco deve ser ignorada na confirmação"

    imported = @book.chapters.ordered.last
    assert_equal "A descoberta revisada", imported.title
    assert_equal "<p>João caminhou entre as árvores.</p>", imported.content
    assert_operator imported.word_count, :>, 0
  end

  test "canceling discards the import without creating chapters" do
    login_as @author
    visit write_book_path(@book)

    click_on "Importar"
    attach_file("Arquivo de texto", sample_file)
    click_on "Analisar arquivo"

    assert_text "capítulos encontrados"

    created_import = @book.book_imports.ready.order(:created_at).last
    chapters_before = @book.chapters.count

    click_on "Cancelar"

    assert_selector "h1", text: "Livro Rascunho"
    assert_equal chapters_before, @book.chapters.count
    assert_not BookImport.exists?(created_import.id)
  end

  private

  def sample_file
    path = File.join(@upload_dir, "livro.txt")
    File.write(path, <<~TEXT)
      Capítulo 1
      A chegada

      Era uma noite escura na floresta.

      Capítulo 2
      A descoberta

      João caminhou entre as árvores.
    TEXT
    path
  end
end
