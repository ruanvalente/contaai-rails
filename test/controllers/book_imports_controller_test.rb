# frozen_string_literal: true

require "test_helper"
require "tmpdir"
require "fileutils"

class BookImportsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @author = users(:author)
    @reader = users(:reader)
    @book = books(:draft_book)
    @upload_dir = Dir.mktmpdir
    @valid_file = upload_fixture("livro.txt", <<~TEXT)
      Capítulo 1
      A chegada

      Era uma noite escura.

      Capítulo 2
      A descoberta

      João caminhou pela floresta.
    TEXT
  end

  teardown do
    FileUtils.remove_entry(@upload_dir) if @upload_dir && File.exist?(@upload_dir)
  end

  test "new requires authentication" do
    get new_book_import_path(@book)
    assert_redirected_to new_user_session_path
  end

  test "new is forbidden for non-owners" do
    sign_in @reader
    get new_book_import_path(@book)
    assert_response :forbidden
  end

  test "new renders upload form for owner" do
    sign_in @author
    get new_book_import_path(@book)
    assert_response :success
    assert_select "input[type=file]"
  end

  test "create parses file and stores ready import" do
    sign_in @author

    count_before = BookImport.count
    post book_import_path(@book), params: { file: @valid_file }

    import = BookImport.last
    assert import.ready?
    assert_equal 2, import.parsed_chapters.size
    assert_equal "livro.txt", import.filename
    assert_redirected_to book_import_path(@book)
  end

  test "create replaces previous unconfirmed imports" do
    sign_in @author
    stale = @book.book_imports.create!(user: @author, filename: "velho.txt", status: :ready, parsed_data: [])

    post book_import_path(@book), params: { file: @valid_file }

    refute BookImport.exists?(stale.id)
  end

  test "create redirects with alert when no chapters detected" do
    sign_in @author
    plain_file = upload_fixture("simples.txt", "Apenas um parágrafo solto, sem marcadores.")

    assert_no_difference "BookImport.count" do
      post book_import_path(@book), params: { file: plain_file }
    end

    assert_redirected_to new_book_import_path(@book)
    follow_redirect!
    assert_match /Não conseguimos identificar/, flash[:alert]
  end

  test "create rejects unsupported format with alert" do
    sign_in @author
    pdf_file = upload_fixture("documento.pdf", "%PDF-1.4 fake")

    post book_import_path(@book), params: { file: pdf_file }

    assert_redirected_to new_book_import_path(@book)
    follow_redirect!
    assert_match /Formato não suportado/, flash[:alert]
    assert_equal 1, @book.book_imports.failed.count
    assert_no_difference -> { @book.book_imports.ready.count } do
      post book_import_path(@book), params: { file: pdf_file }
    end
  end

  test "create records failed import for observability when parse fails" do
    sign_in @author
    binary_file = upload_fixture("binario.txt", "%PDF-1.4 \x00\x01 body")

    post book_import_path(@book), params: { file: binary_file }

    failed = @book.book_imports.failed.last
    assert_not_nil failed
    assert_equal "binario.txt", failed.filename
    assert_match /texto legível/, failed.error_message
  end

  test "show renders preview for ready import" do
    sign_in @author
    @book.book_imports.create!(
      user: @author, filename: "livro.txt", status: :ready,
      parsed_data: [ { "title" => "Capítulo 1", "content" => "<p>Texto</p>", "confidence" => 0.95 } ]
    )

    get book_import_path(@book)

    assert_response :success
    assert_select "input[name$='[title]']"
    assert_select "textarea[name$='[content]']"
  end

  test "confirm creates chapters in order within transaction" do
    sign_in @author
    @book.chapters.destroy_all
    @book.book_imports.create!(
      user: @author, filename: "livro.txt", status: :ready,
      parsed_data:
        [ { "title" => "Capítulo 1", "content" => "<p>Um</p>", "confidence" => 0.95 },
          { "title" => "Capítulo 2", "content" => "<p>Dois</p>", "confidence" => 0.95 } ]
    )

    assert_difference "@book.chapters.count", 2 do
      patch confirm_book_import_path(@book), params: {
        book_import: {
          chapters: [
            { title: "Capítulo 1 — Editado", content: "Primeiro parágrafo.\n\nSegundo parágrafo." },
            { title: "Capítulo 2", content: "Conteúdo dois." }
          ]
        }
      }
    end

    assert_redirected_to write_book_path(@book)

    first_chapter = @book.chapters.ordered.first
    assert_equal "Capítulo 1 — Editado", first_chapter.title
    assert_equal "<p>Primeiro parágrafo.</p><p>Segundo parágrafo.</p>", first_chapter.content
    assert_equal 4, first_chapter.word_count
    second_chapter = @book.chapters.ordered.second
    assert_operator first_chapter.position, :<, second_chapter.position
    assert @book.reload.chapters.sum(:word_count) > 0
  end

  test "confirm marks import as confirmed" do
    sign_in @author
    import = @book.book_imports.create!(
      user: @author, filename: "livro.txt", status: :ready,
      parsed_data: [ { "title" => "Capítulo 1", "content" => "<p>x</p>", "confidence" => 0.95 } ]
    )

    patch confirm_book_import_path(@book), params: {
      book_import: { chapters: [ { title: "Capítulo 1", content: "x" } ] }
    }

    assert import.reload.confirmed?
  end

  test "confirm rolls back everything when one chapter is invalid" do
    sign_in @author
    @book.book_imports.create!(
      user: @author, filename: "livro.txt", status: :ready,
      parsed_data: [ { "title" => "Ok", "content" => "<p>x</p>", "confidence" => 0.95 } ]
    )
    chapters_before = @book.chapters.count

    patch confirm_book_import_path(@book), params: {
      book_import: {
        chapters: [
          { title: "Válido", content: "texto" },
          { title: "", content: "sem título" }
        ]
      }
    }

    assert_redirected_to book_import_path(@book)
    assert_equal chapters_before, @book.chapters.count
  end

  test "confirm ignores fully blank rows and rejects empty submission" do
    sign_in @author
    @book.book_imports.create!(
      user: @author, filename: "livro.txt", status: :ready, parsed_data: []
    )

    patch confirm_book_import_path(@book), params: {
      book_import: { chapters: [ { title: "", content: "" } ] }
    }

    assert_redirected_to book_import_path(@book)
    follow_redirect!
    assert_match /pelo menos um capítulo/i, flash[:alert]
  end

  test "imported chapters satisfy editor contract and feed publication" do
    sign_in @author
    @book.chapters.destroy_all
    @book.book_imports.create!(
      user: @author, filename: "livro.txt", status: :ready,
      parsed_data: [ { "title" => "Capítulo 1", "content" => "<p>Texto</p>", "confidence" => 0.95 } ]
    )

    patch confirm_book_import_path(@book), params: {
      book_import: { chapters: [ { title: "Capítulo <b>Um</b> & Dois", content: "Um dois três quatro." } ] }
    }
    assert_redirected_to write_book_path(@book)

    chapter = @book.chapters.ordered.last
    assert_equal "<p>Um dois três quatro.</p>", chapter.content
    assert_operator chapter.word_count, :>, 0

    patch publish_book_path(@book)
    @book.reload

    assert @book.published?
    assert_includes @book.content, "<h2>Capítulo &lt;b&gt;Um&lt;/b&gt; &amp; Dois</h2>"
    assert_includes @book.content, chapter.content
  end

  test "destroy discards pending import" do
    sign_in @author
    import = @book.book_imports.create!(user: @author, filename: "a.txt", status: :ready, parsed_data: [])

    delete book_import_path(@book)

    assert_not BookImport.exists?(import.id)
    assert_redirected_to write_book_path(@book)
  end

  test "owner-only access on all actions" do
    sign_in @reader

    get new_book_import_path(@book)
    assert_response :forbidden

    post book_import_path(@book), params: { file: @valid_file }
    assert_response :forbidden

    get book_import_path(@book)
    assert_response :forbidden

    patch confirm_book_import_path(@book)
    assert_response :forbidden

    delete book_import_path(@book)
    assert_response :forbidden
  end

  private

  def upload_fixture(filename, content)
    path = File.join(@upload_dir, filename)
    File.write(path, content)

    Rack::Test::UploadedFile.new(path, "text/plain")
  end
end
