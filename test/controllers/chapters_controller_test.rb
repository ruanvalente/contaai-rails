require "test_helper"

class ChaptersControllerTest < ActionDispatch::IntegrationTest
  setup do
    @author = users(:author)
    @reader = users(:reader)
    @book = books(:draft_book)
    @chapter = chapters(:chapter_one)
  end

  test "index requires authentication" do
    get book_chapters_path(@book)
    assert_redirected_to new_user_session_path
  end

  test "index returns the owner's chapters" do
    sign_in @author
    get book_chapters_path(@book)
    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 2, body.length
    assert_equal "Capítulo Um", body.first["title"]
  end

  test "index is forbidden for non-owners" do
    sign_in @reader
    get book_chapters_path(@book)
    assert_response :forbidden
  end

  test "show returns the chapter to the owner" do
    sign_in @author
    get book_chapter_path(@book, @chapter)
    assert_response :success
    body = JSON.parse(response.body)
    assert_equal @chapter.id, body["id"]
    assert_equal "<p>Hello world</p>", body["content"]
  end

  test "show is forbidden for non-owners" do
    sign_in @reader
    get book_chapter_path(@book, @chapter)
    assert_response :forbidden
  end

  test "create creates a chapter with a sequential position" do
    sign_in @author
    assert_difference "@book.chapters.count", 1 do
      post book_chapters_path(@book), params: { chapter: { title: "Novo", content: "<p>oi</p>" } }, as: :json
    end
    assert_response :created
    body = JSON.parse(response.body)
    assert_equal 2, body["position"]
    assert_equal 1, body["word_count"]
  end

  test "create sanitizes content (XSS)" do
    sign_in @author
    post book_chapters_path(@book), params: { chapter: { title: "XSS", content: "<script></script><p>ok</p>" } }, as: :json
    assert_response :created
    body = JSON.parse(response.body)
    refute_match(/<script/i, body["content"])
  end

  test "create returns an error without a title" do
    sign_in @author
    post book_chapters_path(@book), params: { chapter: { title: "", content: "<p>x</p>" } }, as: :json
    assert_response :unprocessable_entity
    body = JSON.parse(response.body)
    assert_includes body["errors"], "Title can't be blank"
  end

  test "update persists content and recalculates counts on the backend" do
    sign_in @author
    patch book_chapter_path(@book, @chapter), params: { chapter: { content: "<h1>Olá</h1><p>mundo legal</p>", word_count: 999 } }, as: :json
    assert_response :success
    @chapter.reload
    assert_equal "<h1>Olá</h1><p>mundo legal</p>", @chapter.content
    assert_equal 3, @chapter.word_count
    assert_equal 15, @chapter.character_count
  end

  test "update is forbidden for non-owners" do
    sign_in @reader
    patch book_chapter_path(@book, @chapter), params: { chapter: { content: "<p>hack</p>" } }, as: :json
    assert_response :forbidden
  end

  test "destroy removes a chapter" do
    sign_in @author
    assert_difference "@book.chapters.count", -1 do
      delete book_chapter_path(@book, @chapter)
    end
    assert_response :no_content
  end

  test "destroy is forbidden for non-owners" do
    sign_in @reader
    delete book_chapter_path(@book, @chapter)
    assert_response :forbidden
  end

  test "reorder moves a chapter to a new position" do
    sign_in @author
    chapter_two = chapters(:chapter_two)
    patch reorder_book_chapters_path(@book), params: { ordered_ids: [ chapter_two.id, @chapter.id ] }, as: :json
    assert_response :success
    body = JSON.parse(response.body)
    assert_equal [ chapter_two.id, @chapter.id ], body.map { |c| c["id"] }
    assert_equal 0, chapter_two.reload.position
    assert_equal 1, @chapter.reload.position
  end

  test "reorder with the same order changes nothing" do
    sign_in @author
    chapter_two = chapters(:chapter_two)
    patch reorder_book_chapters_path(@book), params: { ordered_ids: [ @chapter.id, chapter_two.id ] }, as: :json
    assert_response :success
    assert_equal 0, @chapter.reload.position
    assert_equal 1, chapter_two.reload.position
  end

  test "reorder with invalid ids changes nothing" do
    sign_in @author
    chapter_two = chapters(:chapter_two)
    patch reorder_book_chapters_path(@book), params: { ordered_ids: [ chapter_two.id, 999_999, @chapter.id ] }, as: :json
    assert_response :unprocessable_entity
    assert_equal 0, @chapter.reload.position
    assert_equal 1, chapter_two.reload.position
  end

  test "reorder with non-array ordered_ids responds unprocessable_entity" do
    sign_in @author
    patch reorder_book_chapters_path(@book), params: { ordered_ids: "1,2" }, as: :json
    assert_response :unprocessable_entity
  end

  test "reorder with junk ids responds unprocessable_entity" do
    sign_in @author
    chapter_two = chapters(:chapter_two)
    patch reorder_book_chapters_path(@book), params: { ordered_ids: [ @chapter.id.to_f, chapter_two.id ] }, as: :json
    assert_response :unprocessable_entity
    patch reorder_book_chapters_path(@book), params: { ordered_ids: [ "abc", @chapter.id, chapter_two.id ] }, as: :json
    assert_response :unprocessable_entity
    assert_equal 0, @chapter.reload.position
    assert_equal 1, chapter_two.reload.position
  end

  test "reorder is forbidden for non-owners" do
    sign_in @reader
    chapter_two = chapters(:chapter_two)
    patch reorder_book_chapters_path(@book), params: { ordered_ids: [ chapter_two.id, @chapter.id ] }, as: :json
    assert_response :forbidden
  end
end
