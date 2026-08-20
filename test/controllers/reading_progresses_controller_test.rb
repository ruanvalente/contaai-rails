require "test_helper"

class ReadingProgressesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:author)
    @book = books(:published_book)
    @chapter = chapters(:published_chapter)
    sign_in @user
  end

  test "update creates reading progress for new book" do
    progress = ReadingProgress.find_by(user: @user, book: @book)
    progress&.destroy

    assert_difference("ReadingProgress.count", 1) do
      patch book_reading_progress_path(@book),
            params: { chapter_id: @chapter.id },
            as: :json
    end

    assert_response :success
    json = JSON.parse(response.body)
    assert json["success"]
    assert_equal @chapter.id, json["current_chapter_id"]
  end

  test "update updates existing reading progress" do
    progress = ReadingProgress.find_or_create_by!(user: @user, book: @book) do |rp|
      rp.current_chapter = @chapter
      rp.status = :reading
      rp.percentage = 0
    end

    patch book_reading_progress_path(@book),
          params: { chapter_id: @chapter.id },
          as: :json

    assert_response :success
    progress.reload
    assert_equal @chapter.id, progress.current_chapter_id
  end

  test "update returns percentage" do
    patch book_reading_progress_path(@book),
          params: { chapter_id: @chapter.id },
          as: :json

    assert_response :success
    json = JSON.parse(response.body)
    assert json.key?("percentage")
  end

  test "update requires authentication" do
    sign_out @user

    patch book_reading_progress_path(@book),
          params: { chapter_id: @chapter.id },
          as: :json

    assert_response :unauthorized
  end

  test "update with invalid chapter returns error" do
    patch book_reading_progress_path(@book),
          params: { chapter_id: 0 },
          as: :json

    assert_response :not_found
  end
end
