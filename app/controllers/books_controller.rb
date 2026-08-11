class BooksController < ApplicationController
  before_action :authenticate_user!, except: [ :index, :show ]
  before_action :set_book, only: [ :show, :edit, :update, :destroy, :publish, :unpublish, :read, :write ]

  def index
    @books = Book.published.includes(:user).order(published_at: :desc)
  end

  def show
  end

  def new
    @book = current_user.books.build
  end

  def create
    @book = current_user.books.build(book_params)
    if @book.save
      redirect_to @book, notice: "Livro criado com sucesso."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    authorize_book_owner! or return
  end

  def update
    authorize_book_owner! or return
    handle_cover_removal
    if @book.update(book_params)
      redirect_to @book, notice: "Livro atualizado com sucesso."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    authorize_book_owner! or return
    @book.destroy
    respond_to do |f|
      f.html { redirect_to dashboard_path, notice: "Livro excluído com sucesso." }
      f.json { head :no_content }
    end
  end

  def publish
    unless @book.user == current_user
      respond_to do |f|
        f.html { redirect_to @book, alert: "Não autorizado." }
        f.json { render json: { error: "Não autorizado." }, status: :forbidden }
      end
      return
    end

    unless @book.draft?
      respond_to do |f|
        f.html { redirect_to @book, alert: "Livro já publicado." }
        f.json { render json: { error: "Livro já publicado." }, status: :unprocessable_entity }
      end
      return
    end

    unless @book.publishable?
      respond_to do |f|
        f.html { redirect_to @book, alert: "O livro não atende os requisitos para publicação." }
        f.json do
          render json: {
            error: "O livro não atende os requisitos para publicação.",
            publishable: false,
            checks: {
              title: @book.title.present?,
              chapters: @book.has_chapters? && @book.chapters.sum(:word_count) > 0,
              category: @book.category.present?
            }
          }, status: :unprocessable_entity
        end
      end
      return
    end

    full_content = @book.chapters.ordered.map do |chapter|
      "<h2>#{CGI.escapeHTML(chapter.title)}</h2>\n\n#{chapter.content}"
    end.join("\n\n")

    if @book.update(status: :published, published_at: Time.current, content: full_content)
      respond_to do |f|
        f.html { redirect_to @book, notice: "Livro publicado com sucesso." }
        f.json { render json: { success: true, published_at: @book.published_at } }
      end
    else
      respond_to do |f|
        f.html { redirect_to @book, alert: "Não foi possível publicar o livro." }
        f.json { render json: { error: "Não foi possível publicar o livro." }, status: :unprocessable_entity }
      end
    end
  end

  def unpublish
    unless @book.user == current_user
      redirect_to @book, alert: "Não autorizado." and return
    end

    unless @book.published?
      redirect_to @book, alert: "Livro não está publicado." and return
    end

    if @book.update(status: :draft, published_at: nil)
      redirect_to @book, notice: "Livro despublicado. Voltando para rascunho."
    else
      redirect_to @book, alert: "Não foi possível despublicar o livro."
    end
  end

  def write
    authorize_book_owner! or return
    @chapters = @book.chapters.ordered
    @active_chapter = @chapters.first
  end

  def read
  end

  private

  def set_book
    @book = Book.find(params[:id])
  end

  def authorize_book_owner!
    unless @book.user == current_user
      respond_to do |f|
        f.html { redirect_to root_path, alert: "Não autorizado." }
        f.json { render json: { error: "Não autorizado." }, status: :forbidden }
      end
      return false
    end
    true
  end

  def book_params
    params.require(:book).permit(:title, :description, :content, :category, :cover_color, :author_name, :cover_image)
  end

  def handle_cover_removal
    if params[:book][:remove_cover] == "1" && @book.cover_image.attached?
      @book.cover_image.purge_later
    end
  end
end
