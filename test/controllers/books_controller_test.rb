require "test_helper"

class BooksControllerTest < ActionDispatch::IntegrationTest
  setup do
    @author = users(:author)
    @reader = users(:reader)
    @draft_book = books(:draft_book)
    @published_book = books(:published_book)
    @other_book = books(:other_book)
  end

  test "index lists only published books for everyone" do
    get books_path
    assert_response :success
    assert_includes response.body, "Livro Publicado"
    refute_includes response.body, "Livro Rascunho"
  end

  test "show is public" do
    get book_path(@published_book)
    assert_response :success
  end

  test "new requires authentication" do
    get new_book_path
    assert_redirected_to new_user_session_path
  end

  test "create creates a book as draft" do
    sign_in @author
    assert_difference "@author.books.count", 1 do
      post books_path, params: { book: { title: "Novo Livro", description: "Descrição", author_name: "Autor Exemplo", category: "fiction" } }
    end
    assert_redirected_to book_path(Book.last)
    assert Book.last.draft?
  end

  test "create returns an error without a title" do
    sign_in @author
    post books_path, params: { book: { title: "", category: "fiction" } }
    assert_response :unprocessable_entity
  end

  test "edit requires ownership" do
    sign_in @reader
    get edit_book_path(@draft_book)
    assert_redirected_to root_path
    assert_equal "Não autorizado.", flash[:alert]
  end

  test "update updates the owner's book" do
    sign_in @author
    patch book_path(@draft_book), params: { book: { title: "Título Atualizado" } }
    assert_redirected_to book_path(@draft_book)
    assert_equal "Título Atualizado", @draft_book.reload.title
  end

  test "destroy removes the book for the owner (JSON)" do
    sign_in @author
    assert_difference "Book.count", -1 do
      delete book_path(@draft_book), as: :json
    end
    assert_response :no_content
  end

  test "destroy is forbidden for non-owners" do
    sign_in @reader
    assert_no_difference "Book.count" do
      delete book_path(@draft_book), as: :json
    end
    assert_response :forbidden
  end

  test "publish requires ownership" do
    sign_in @reader
    patch publish_book_path(@draft_book), as: :json
    assert_response :forbidden
    assert @draft_book.draft?
  end

  test "publish fails for an already published book" do
    sign_in @author
    patch publish_book_path(@published_book), as: :json
    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_equal "Livro já publicado.", body["error"]
  end

  test "publish returns requirement checks for a book without chapters" do
    sign_in @reader
    patch publish_book_path(@other_book), as: :json
    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_equal false, body["publishable"]
    assert_equal true, body["checks"]["title"]
    assert_equal false, body["checks"]["chapters"]
    assert_equal true, body["checks"]["category"]
    assert @other_book.draft?
  end

  test "publish generates HTML content without markdown" do
    sign_in @author
    patch publish_book_path(@draft_book), as: :json
    assert_response :success
    @draft_book.reload
    assert @draft_book.published?
    assert_not_nil @draft_book.published_at
    assert_includes @draft_book.content, "<h2>Capítulo Um</h2>"
    assert_includes @draft_book.content, "<h2>Capítulo Dois</h2>"
    assert_includes @draft_book.content, "<p>Hello world</p>"
    refute_includes @draft_book.content, "##"
  end

  test "publish (HTML) redirects with a notice" do
    sign_in @author
    patch publish_book_path(@draft_book)
    assert_response :see_other
    assert_equal "Livro publicado com sucesso.", flash[:notice]
  end

  test "unpublish requires ownership" do
    sign_in @reader
    patch unpublish_book_path(@published_book)
    assert_redirected_to book_path(@published_book)
    assert_equal "Não autorizado.", flash[:alert]
    assert @published_book.published?
  end

  test "unpublish fails for a draft book" do
    sign_in @author
    patch unpublish_book_path(@draft_book)
    assert_redirected_to book_path(@draft_book)
    assert_equal "Livro não está publicado.", flash[:alert]
  end

  test "unpublish returns the book to draft" do
    sign_in @author
    patch unpublish_book_path(@published_book)
    assert_response :redirect
    @published_book.reload
    assert @published_book.draft?
    assert_nil @published_book.published_at
  end

  test "write requires ownership" do
    sign_in @reader
    get write_book_path(@draft_book)
    assert_redirected_to root_path
    assert_equal "Não autorizado.", flash[:alert]
  end

  test "write renders the owner's editor" do
    sign_in @author
    get write_book_path(@draft_book)
    assert_response :success
    assert_includes response.body, "Capítulo Um"
  end

  test "read requires authentication" do
    get read_book_path(@published_book)
    assert_redirected_to new_user_session_path
  end

  test "read renders reading for an authenticated user" do
    sign_in @reader
    get read_book_path(@published_book)
    assert_response :success
    assert_includes response.body, "Hello world"
  end
end
