class ReadingProgressesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_book

  def update
    unless @book.published?
      render json: { error: "Livro não está publicado." }, status: :forbidden
      return
    end

    @progress = current_user.reading_progresses.find_or_initialize_by(book: @book)
    @chapter = @book.chapters.find(params[:chapter_id])

    if @progress.update(
      current_chapter: @chapter,
      last_read_at: Time.current,
      started_at: @progress.started_at || Time.current,
      status: :reading
    )
      @progress.recalculate_percentage!
      render json: {
        success: true,
        percentage: @progress.percentage,
        current_chapter_id: @chapter.id,
        status: @progress.status
      }
    else
      render json: { errors: @progress.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def set_book
    @book = Book.find(params[:book_id])
  end
end
