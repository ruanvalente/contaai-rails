class ChaptersController < ApplicationController
  before_action :authenticate_user!
  before_action :set_book
  before_action :set_chapter, only: [ :show, :update, :destroy, :reorder ]

  def index
    @chapters = @book.chapters.ordered
    render json: @chapters
  end

  def show
    render json: @chapter
  end

  def create
    unless @book.user == current_user
      render json: { error: "Não autorizado" }, status: :forbidden and return
    end

    @chapter = @book.chapters.build(chapter_params)

    if @chapter.save
      render json: @chapter, status: :created
    else
      render json: { errors: @chapter.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    unless @book.user == current_user
      render json: { error: "Não autorizado" }, status: :forbidden and return
    end

    if @chapter.update(chapter_params)
      render json: @chapter
    else
      render json: { errors: @chapter.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    unless @book.user == current_user
      render json: { error: "Não autorizado" }, status: :forbidden and return
    end

    @chapter.destroy
    head :no_content
  end

  def reorder
    unless @book.user == current_user
      render json: { error: "Não autorizado" }, status: :forbidden and return
    end

    new_position = params[:position].to_i
    old_position = @chapter.position

    return render json: @book.chapters.ordered if old_position == new_position

    ActiveRecord::Base.transaction do
      if new_position > old_position
        @book.chapters.where("position > ? AND position <= ?", old_position, new_position)
             .where.not(id: @chapter.id)
             .update_all("position = position - 1")
      else
        @book.chapters.where("position >= ? AND position < ?", new_position, old_position)
             .where.not(id: @chapter.id)
             .update_all("position = position + 1")
      end

      @chapter.update!(position: new_position)
    end

    render json: @book.chapters.ordered
  end

  private

  def set_book
    @book = Book.find(params[:book_id])
  end

  def set_chapter
    @chapter = @book.chapters.find(params[:id])
  end

  def chapter_params
    params.require(:chapter).permit(:title, :content, :word_count)
  end
end
